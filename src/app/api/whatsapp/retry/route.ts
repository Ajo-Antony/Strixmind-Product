/**
 * /api/whatsapp/retry  — WhatsApp Failure Handling + Retry Queue
 *
 * Handles:
 *   - Delivery failures (rate limits, invalid numbers, Meta downtime)
 *   - Template rejections
 *   - Automatic exponential-backoff retry
 *   - Escalation after max retries
 *
 * Flow:  Send Message → Delivery Status → Failed? → Retry Queue → Escalation
 *
 * Call this route from:
 *   1. Your sendTextMessage / sendTemplate wrappers on failure
 *   2. A cron job (every 5 min) to process the retry queue
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import { sendTextMessage } from '@/lib/whatsapp'

// ── WhatsApp error categories ─────────────────────────────────────────────────
type WaErrorCode =
  | 'RATE_LIMIT'         // 429 — too many messages
  | 'INVALID_NUMBER'     // 400 — number not on WhatsApp
  | 'TEMPLATE_REJECTED'  // 400 — template not approved
  | 'META_OUTAGE'        // 5xx — Meta API down
  | 'EXPIRED_TOKEN'      // 401 — token expired
  | 'UNKNOWN'

interface RetryJob {
  id: string
  conversation_id: string
  contact_phone: string
  message_type: 'text' | 'template'
  content: string
  template_name?: string
  template_variables?: string[]
  error_code: WaErrorCode
  error_message: string
  attempt_count: number
  max_attempts: number
  next_attempt_at: string
  status: 'pending' | 'retrying' | 'succeeded' | 'failed' | 'escalated'
  created_at: string
}

// ── Classify WhatsApp error from API response ─────────────────────────────────
function classifyError(statusCode: number, errorMsg: string): WaErrorCode {
  if (statusCode === 429) return 'RATE_LIMIT'
  if (statusCode === 401) return 'EXPIRED_TOKEN'
  if (statusCode >= 500) return 'META_OUTAGE'
  if (errorMsg.includes('invalid') || errorMsg.includes('not a valid')) return 'INVALID_NUMBER'
  if (errorMsg.includes('template') && (errorMsg.includes('reject') || errorMsg.includes('not approved'))) return 'TEMPLATE_REJECTED'
  return 'UNKNOWN'
}

// ── Retry delay strategy (exponential backoff) ────────────────────────────────
function nextRetryDelay(attempt: number, errorCode: WaErrorCode): number {
  const baseDelayMs: Record<WaErrorCode, number> = {
    RATE_LIMIT:        60_000,    // 1 min for rate limit
    INVALID_NUMBER:    0,         // don't retry invalid numbers
    TEMPLATE_REJECTED: 0,         // don't retry — needs manual fix
    META_OUTAGE:       120_000,   // 2 min for outage
    EXPIRED_TOKEN:     0,         // don't retry — token fix needed
    UNKNOWN:           30_000,    // 30s for unknown
  }

  const base = baseDelayMs[errorCode] ?? 30_000
  if (!base) return 0   // 0 means don't retry

  // Exponential backoff: 1x, 2x, 4x, 8x
  return base * Math.pow(2, attempt - 1)
}

// ── Process a single retry job ────────────────────────────────────────────────
async function processRetryJob(job: RetryJob, db: any): Promise<'succeeded' | 'failed' | 'escalated' | 'skipped'> {
  // Skip non-retryable errors
  if (['INVALID_NUMBER', 'TEMPLATE_REJECTED', 'EXPIRED_TOKEN'].includes(job.error_code)) {
    await db.from('message_retry_queue').update({
      status:    'escalated',
      updated_at: new Date().toISOString(),
    }).eq('id', job.id)

    await escalate(job, 'Non-retryable error: ' + job.error_code, db)
    return 'escalated'
  }

  // Mark as retrying
  await db.from('message_retry_queue').update({
    status:        'retrying',
    attempt_count: job.attempt_count + 1,
    updated_at:    new Date().toISOString(),
  }).eq('id', job.id)

  try {
    if (job.message_type === 'text') {
      await sendTextMessage(job.contact_phone, job.content)
    } else {
      // Template retry — re-send via WhatsApp template API
      const apiVersion = process.env.NEXT_PUBLIC_WHATSAPP_API_VERSION ?? 'v19.0'
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
      const token = process.env.WHATSAPP_API_TOKEN
      if (!phoneNumberId || !token) throw new Error('Missing WhatsApp credentials')

      const body: any = {
        messaging_product: 'whatsapp',
        to: job.contact_phone.replace(/\D/g, ''),
        type: 'template',
        template: {
          name: job.template_name,
          language: { code: 'en_US' },
        },
      }
      if (job.template_variables?.length) {
        body.template.components = [{
          type: 'body',
          parameters: job.template_variables.map(v => ({ type: 'text', text: v })),
        }]
      }

      const res = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message ?? `HTTP ${res.status}`)
      }
    }

    // Success — update job and mark original message as sent
    await db.from('message_retry_queue').update({
      status:     'succeeded',
      updated_at: new Date().toISOString(),
    }).eq('id', job.id)

    await db.from('messages').update({
      status: 'sent',
      metadata: { retried: true, attempt: job.attempt_count + 1 },
    }).eq('conversation_id', job.conversation_id).eq('status', 'failed')

    return 'succeeded'

  } catch (err: any) {
    const newAttempt = job.attempt_count + 1

    if (newAttempt >= job.max_attempts) {
      await db.from('message_retry_queue').update({
        status:        'escalated',
        attempt_count: newAttempt,
        updated_at:    new Date().toISOString(),
      }).eq('id', job.id)

      await escalate(job, `Max retries (${job.max_attempts}) reached. Last error: ${err.message}`, db)
      return 'escalated'
    }

    const delay = nextRetryDelay(newAttempt, job.error_code)
    const nextAt = new Date(Date.now() + delay).toISOString()

    await db.from('message_retry_queue').update({
      status:          'pending',
      attempt_count:   newAttempt,
      next_attempt_at: nextAt,
      error_message:   err.message,
      updated_at:      new Date().toISOString(),
    }).eq('id', job.id)

    return 'failed'
  }
}

// ── Escalation handler ────────────────────────────────────────────────────────
async function escalate(job: RetryJob, reason: string, db: any) {
  // Create urgent task for human follow-up
  const { data: conv } = await db.from('conversations')
    .select('lead_id, contact:contacts(name)')
    .eq('id', job.conversation_id).single()

  await db.from('tasks').insert({
    title:        `[MESSAGE FAILED] Follow up with ${(conv?.contact as any)?.name ?? job.contact_phone}`,
    lead_id:      conv?.lead_id ?? null,
    priority:     'urgent',
    due_date:     new Date(Date.now() + 30 * 60_000).toISOString(),
    ai_generated: true,
    ai_reasoning: `WhatsApp message delivery failed after ${job.attempt_count} attempts. Reason: ${reason}. Error: ${job.error_code}`,
    status:       'pending',
  }).catch(() => {})

  // Notification to team
  await db.from('notifications').insert({
    type:      'whatsapp_delivery_failed',
    title:     'WhatsApp message failed to deliver',
    body:      `Message to ${job.contact_phone} failed: ${reason}`,
    metadata:  { job_id: job.id, conversation_id: job.conversation_id, error_code: job.error_code },
    read:      false,
    created_at: new Date().toISOString(),
  }).catch(() => {})
}

// ── POST: enqueue a failed message for retry ──────────────────────────────────
export async function POST(req: NextRequest) {
  const db = createSupabaseServiceClient()
  try {
    const body = await req.json()
    const { conversation_id, contact_phone, message_type, content, template_name, template_variables, status_code, error_message } = body

    if (!conversation_id || !contact_phone || !message_type || !content) {
      return NextResponse.json({ error: 'conversation_id, contact_phone, message_type, content required' }, { status: 400 })
    }

    const errorCode = classifyError(status_code ?? 0, error_message ?? '')
    const delay = nextRetryDelay(1, errorCode)

    if (delay === 0) {
      // Non-retryable — escalate immediately
      const fakeJob = { id: '', conversation_id, contact_phone, message_type, content, template_name, template_variables, error_code: errorCode, error_message, attempt_count: 1, max_attempts: 1, next_attempt_at: '', status: 'escalated' as const, created_at: '' }
      await escalate(fakeJob, `Non-retryable error: ${errorCode}`, db)
      return NextResponse.json({ data: { queued: false, reason: 'non_retryable', error_code: errorCode } })
    }

    const { data, error } = await db.from('message_retry_queue').insert({
      conversation_id,
      contact_phone,
      message_type,
      content,
      template_name:      template_name ?? null,
      template_variables: template_variables ?? [],
      error_code:         errorCode,
      error_message:      error_message ?? '',
      attempt_count:      0,
      max_attempts:       4,
      next_attempt_at:    new Date(Date.now() + delay).toISOString(),
      status:             'pending',
      created_at:         new Date().toISOString(),
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: { queued: true, job_id: data.id, error_code: errorCode, next_attempt_at: data.next_attempt_at } }, { status: 201 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── GET: process pending retry jobs (cron endpoint) ───────────────────────────
export async function GET(req: NextRequest) {
  const db = createSupabaseServiceClient()

  const { data: jobs } = await db
    .from('message_retry_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(20)

  if (!jobs?.length) return NextResponse.json({ data: { processed: 0, results: [] } })

  const results: { id: string; result: string }[] = []
  for (const job of jobs) {
    const result = await processRetryJob(job as RetryJob, db)
    results.push({ id: job.id, result })
    // Rate limit the retry processor itself
    await new Promise(r => setTimeout(r, 200))
  }

  const succeeded  = results.filter(r => r.result === 'succeeded').length
  const escalated  = results.filter(r => r.result === 'escalated').length
  const stillPending = results.filter(r => r.result === 'failed').length

  return NextResponse.json({ data: { processed: results.length, succeeded, escalated, still_pending: stillPending, results } })
}
