/**
 * src/app/api/webhooks/whatsapp/route.ts
 *
 * UPDATED — integrates all new features:
 *   - Feature 3: Full lead qualification pipeline (7 stages)
 *   - Feature 4: Human handoff confidence check
 *   - Feature 5: RAG knowledge base lookup before AI reply
 *   - Feature 6: WhatsApp failure handling + retry queue
 *   - Feature 9: Notification center events
 *   - Feature 12: Memory enrichment for AI context
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import {
  parseWebhookMessage,
  parseWebhookStatus,
  markAsRead,
  sendTextMessage,
  WhatsAppWebhookBody,
} from '@/lib/whatsapp'
import { runOrchestrator } from '@/lib/agents/orchestrator'
import { sendNotification, enrichContextWithMemory } from '@/lib/features'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

// ── GET: webhook verification ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// ── POST: incoming messages ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: WhatsAppWebhookBody
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }

  const db = createSupabaseServiceClient()

  // ── Delivery status updates ───────────────────────────────────────────────
  const statusUpdate = parseWebhookStatus(body)
  if (statusUpdate) {
    await db.from('messages').update({ status: statusUpdate.status }).eq('wa_message_id', statusUpdate.waMessageId)

    // Track delivery failures for retry queue
    if (statusUpdate.status === 'failed') {
      const { data: msg } = await db.from('messages').select('conversation_id, content').eq('wa_message_id', statusUpdate.waMessageId).single()
      if (msg) {
        await fetch(`${APP_URL}/api/whatsapp/retry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: msg.conversation_id,
            contact_phone:   body.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]?.recipient_id ?? '',
            message_type:    'text',
            content:         msg.content,
            status_code:     0,
            error_message:   'Delivery failed (status webhook)',
          }),
        }).catch(() => {})
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ── Incoming message ──────────────────────────────────────────────────────
  const msg = parseWebhookMessage(body)
  if (!msg) return NextResponse.json({ ok: true })

  try {
    await markAsRead(msg.waMessageId)

    // 1. Upsert contact
    const { data: contact } = await db
      .from('contacts')
      .upsert({ phone: msg.from, name: msg.customerName }, { onConflict: 'phone' })
      .select().single()
    if (!contact) throw new Error('Could not upsert contact')

    // 2. Find or create conversation
    let { data: conversation } = await db
      .from('conversations')
      .select('*').eq('contact_id', contact.id).in('status', ['open', 'waiting'])
      .order('created_at', { ascending: false }).limit(1).single()

    const textContent = msg.type === 'text' ? msg.text : `[${msg.type}]`

    if (!conversation) {
      const { data: newConv } = await db.from('conversations').insert({
        contact_id:    contact.id,
        status:        'open',
        priority:      'medium',
        ai_auto_reply: true,
        last_message_at:      new Date().toISOString(),
        last_message_preview: textContent?.substring(0, 100),
      }).select().single()
      conversation = newConv
    }

    // 3. Save incoming message
    await db.from('messages').insert({
      conversation_id: conversation.id,
      direction:       'inbound',
      sender_type:     'customer',
      sender_name:     contact.name ?? msg.from,
      type:            msg.type,
      content:         textContent,
      wa_message_id:   msg.waMessageId,
      status:          'delivered',
      created_at:      new Date().toISOString(),
    })

    // Update conversation preview
    await db.from('conversations').update({
      last_message_at:      new Date().toISOString(),
      last_message_preview: textContent?.substring(0, 100),
      updated_at:           new Date().toISOString(),
    }).eq('id', conversation.id)

    // 4. Run full lead qualification pipeline (async, non-blocking)
    fetch(`${APP_URL}/api/leads/qualify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversation.id, contact_id: contact.id }),
    }).catch(() => {})

    // 5. Keyword trigger check
    await triggerKeywordWorkflow(textContent ?? '', { conversationId: conversation.id, contactId: contact.id, message: textContent }, db)

    // 6. AI auto-reply (with memory + RAG + handoff)
    if (conversation.ai_auto_reply) {
      await runAutoReplyWithHandoff(conversation.id, contact.id, textContent ?? '', contact.name ?? msg.from, contact.phone, db)
    }

  } catch (err: any) {
    console.error('[webhook] Error processing message:', err.message)
  }

  return NextResponse.json({ ok: true })
}

// ── Auto-reply with RAG + handoff check ──────────────────────────────────────
async function runAutoReplyWithHandoff(
  conversationId: string,
  contactId: string,
  userMessage: string,
  contactName: string,
  phone: string,
  db: any
) {
  try {
    // A. Enrich context with customer memory
    const memoryContext = await enrichContextWithMemory(conversationId, contactId)

    // B. RAG: retrieve relevant knowledge
    let ragContext = ''
    try {
      const ragRes = await fetch(`${APP_URL}/api/knowledge?action=retrieve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage, conversation_id: conversationId, generate_answer: false }),
      })
      const ragJson = await ragRes.json()
      if (ragJson.data?.context_used && ragJson.data?.sources?.length) {
        ragContext = `Knowledge sources: ${ragJson.data.sources.map((s: any) => s.title).join(', ')}.`
      }
    } catch { /* RAG is optional */ }

    const leadContext = [memoryContext, ragContext].filter(Boolean).join(' | ')

    // C. Run orchestrator
    const result = await runOrchestrator({ conversationId, userMessage, history: [], contactName, leadContext })
    if (!result.reply) return

    // D. Human handoff check
    const handoffRes = await fetch(`${APP_URL}/api/leads/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversationId,
        draft_reply:     result.reply,
        user_message:    userMessage,
        contact_phone:   phone,
      }),
    })
    const handoffJson = await handoffRes.json()

    if (handoffJson.data?.handoff) {
      // Handoff — notify team
      await sendNotification({
        type:            'handoff_assigned',
        title:           `Human handoff: ${contactName}`,
        body:            `Reason: ${handoffJson.data.reason?.replace(/_/g, ' ')} — ${userMessage.slice(0, 80)}`,
        conversation_id: conversationId,
        channels:        ['dashboard', 'push'],
        metadata:        { reason: handoffJson.data.reason, agent: handoffJson.data.assigned_agent },
      })
      return  // don't auto-send
    }

    // E. Send the AI reply
    const finalReply = handoffJson.data?.ai_reply ?? result.reply
    const waRes = await sendTextMessage(phone, finalReply)

    if (!waRes) {
      // Queue for retry
      await fetch(`${APP_URL}/api/whatsapp/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          contact_phone:   phone,
          message_type:    'text',
          content:         finalReply,
          status_code:     500,
          error_message:   'Send failed in auto-reply',
        }),
      }).catch(() => {})
      return
    }

    // F. Persist the outbound message
    await db.from('messages').insert({
      conversation_id: conversationId,
      direction:       'outbound',
      sender_type:     'ai',
      sender_name:     'StrixMind AI',
      type:            'text',
      content:         finalReply,
      status:          'sent',
      metadata: {
        orchestrator:  true,
        totalTokens:   result.totalTokens,
        latencyMs:     result.latencyMs,
        rag_used:      !!ragContext,
        memory_used:   !!memoryContext,
      },
      created_at: new Date().toISOString(),
    })

    await db.from('conversations').update({
      last_message_at:      new Date().toISOString(),
      last_message_preview: finalReply.substring(0, 100),
      updated_at:           new Date().toISOString(),
    }).eq('id', conversationId)

  } catch (err: any) {
    console.error('[autoReply] Error:', err.message)
  }
}

// ── Keyword workflow trigger ──────────────────────────────────────────────────
async function triggerKeywordWorkflow(message: string, data: object, db: any) {
  // Since keyword_trigger is saved as inbound_message in the DB, we query inbound_message
  // workflows that have a keyword config set. Workflows without a keyword config match all messages.
  const { data: workflows } = await db
    .from('workflows')
    .select('id, run_count, trigger_config, steps')
    .eq('trigger_type', 'inbound_message')
    .eq('active', true)

  const msgLower = message.toLowerCase()

  for (const wf of workflows ?? []) {
    const cfg = wf.trigger_config ?? {}
    const keywordRaw: string = cfg.keyword ?? ''
    // If no keyword configured, this is a plain inbound_message trigger — skip keyword matching
    // (it will be handled by the inbound_message workflow trigger separately)
    if (!keywordRaw.trim()) continue
    const keywords: string[] = keywordRaw.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean)
    const matchType: string = cfg.match_type ?? 'contains'
    const matched = keywords.length === 0 || keywords.some((kw: string) => {
      if (matchType === 'exact') return msgLower === kw
      if (matchType === 'starts_with') return msgLower.startsWith(kw)
      return msgLower.includes(kw)
    })
    if (!matched) continue

    await db.from('workflow_runs').insert({
      workflow_id:  wf.id,
      trigger_data: data,
      status:       'pending',
      created_at:   new Date().toISOString(),
    }).catch(() => {})

    await db.from('workflows').update({
      run_count:   (wf.run_count ?? 0) + 1,
      last_run_at: new Date().toISOString(),
    }).eq('id', wf.id)
  }
}
