import { NextRequest, NextResponse } from 'next/server'
import {
  parseWebhookMessage,
  parseWebhookStatus,
  markAsRead,
  sendTextMessage,
  WhatsAppWebhookBody,
} from '@/lib/whatsapp'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import { analyzeLeadFromConversation } from '@/lib/ai'
import { runOrchestrator } from '@/lib/agents/orchestrator'
import { addLog } from '@/lib/logger'

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

// ─── GET: webhook verification ───────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  console.log('[webhook/verify] mode:', mode, 'token:', token, 'expected:', VERIFY_TOKEN)
  addLog('info', 'webhook', `Verification handshake initiated. mode=${mode}`, { token, expected: VERIFY_TOKEN })

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[webhook/verify] ✅ Verified')
    addLog('success', 'webhook', 'Webhook verification successful! Subscribed to Meta triggers.')
    return new NextResponse(challenge, { status: 200 })
  }
  console.warn('[webhook/verify] ❌ Failed — token mismatch')
  addLog('error', 'webhook', 'Webhook verification failed: token mismatch or incorrect mode.', { mode, token })
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

// ─── POST: incoming WhatsApp messages ────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body: WhatsAppWebhookBody = await req.json()
    const db = createSupabaseServiceClient()

    addLog('info', 'webhook', 'Webhook event payload received from Meta.', body)

    // ── Status update ─────────────────────────────────────────
    const statusUpdate = parseWebhookStatus(body)
    if (statusUpdate) {
      addLog('info', 'webhook', `Status update received: Message ID ${statusUpdate.waMessageId} changed to ${statusUpdate.status}`, statusUpdate)
      await db
        .from('messages')
        .update({ status: statusUpdate.status })
        .eq('wa_message_id', statusUpdate.waMessageId)
      return NextResponse.json({ ok: true })
    }

    // ── Incoming message ──────────────────────────────────────
    const msg = parseWebhookMessage(body)
    if (!msg) {
      addLog('info', 'webhook', 'Webhook payload received but contained no messages or status updates.', body)
      return NextResponse.json({ ok: true })
    }

    addLog('success', 'webhook', `Incoming message from ${msg.customerName || msg.from}: "${msg.text || '['+msg.type+']'}"`, msg)

    // 1. Upsert contact
    const { data: contact } = await db
      .from('contacts')
      .upsert({ phone: msg.from, name: msg.customerName }, { onConflict: 'phone' })
      .select()
      .single()

    if (!contact) {
      addLog('error', 'database', `Failed to upsert contact for sender: ${msg.from}`, { msg })
      return NextResponse.json({ ok: true })
    }

    // 2. Find or create conversation
    let { data: conversation } = await db
      .from('conversations')
      .select('*')
      .eq('contact_id', contact.id)
      .in('status', ['open', 'waiting'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const textContent = msg.type === 'text' ? msg.text : `[${msg.type}]`

    if (!conversation) {
      addLog('info', 'database', `Creating new conversation session for contact ID: ${contact.id}`)
      const { data: newConv } = await db
        .from('conversations')
        .insert({
          contact_id: contact.id,
          status: 'open',
          priority: 'medium',
          ai_auto_reply: true,
          last_message_at: msg.timestamp,
          last_message_preview: textContent?.substring(0, 100) ?? null,
          unread_count: 1,
        })
        .select()
        .single()
      conversation = newConv
    } else {
      await db.from('conversations').update({
        status: 'open',
        last_message_at: msg.timestamp,
        last_message_preview: textContent?.substring(0, 100) ?? null,
        unread_count: (conversation.unread_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', conversation.id)
    }

    if (!conversation) {
      addLog('error', 'database', `Failed to locate or provision conversation for contact ID: ${contact.id}`)
      return NextResponse.json({ ok: true })
    }

    // 3. Store inbound message
    await db.from('messages').insert({
      conversation_id: conversation.id,
      wa_message_id: msg.waMessageId,
      direction: 'inbound',
      sender_type: 'customer',
      sender_name: msg.customerName,
      type: msg.type as any,
      content: textContent,
      status: 'delivered',
      wa_timestamp: msg.timestamp,
    })

    // 4. Mark as read
    await markAsRead(msg.waMessageId).catch((err) => {
      addLog('warn', 'webhook', `Could not automatically mark message ${msg.waMessageId} as read: ${err.message}`)
    })

    // 5. Return 200 immediately, do heavy work in background
    runBackground(conversation, contact, msg, textContent ?? '', db).catch(
      err => {
        addLog('error', 'automation', `Orchestrator background thread failed: ${err.message}`, err.stack)
        console.error('[webhook/bg]', err)
      }
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    addLog('error', 'webhook', `Webhook processing error: ${err.message}`, err.stack)
    console.error('[webhook] error:', err)
    return NextResponse.json({ ok: true }) // always 200 to WhatsApp
  }
}

// ─── Background processing ────────────────────────────────────
async function runBackground(conversation: any, contact: any, msg: any, textContent: string, db: any) {
  const analysis = await runLeadAnalysis(conversation.id, contact.id, db)
  const leadContext = analysis
    ? `Intent: ${analysis.intent}, Budget: ₹${analysis.budget ?? 'unknown'}, Urgency: ${analysis.urgency}, Score: ${analysis.ai_score}/100`
    : 'New lead'

  const { data: freshConv } = await db.from('conversations').select('ai_auto_reply').eq('id', conversation.id).single()
  const autoReplyEnabled = freshConv?.ai_auto_reply !== false

  if (autoReplyEnabled && textContent && !textContent.startsWith('[')) {
    try {
      const result = await runOrchestrator({
        conversationId: conversation.id,
        userMessage: textContent,
        history: [],
        contactName: contact.name ?? contact.phone,
        leadContext,
      })
      if (result.reply) {
        await sendTextMessage(msg.from, result.reply)
        await db.from('messages').insert({
          conversation_id: conversation.id,
          direction: 'outbound',
          sender_type: 'ai',
          sender_name: 'StrixMind AI',
          type: 'text',
          content: result.reply,
          status: 'sent',
          metadata: { orchestrator: true, totalTokens: result.totalTokens, latencyMs: result.latencyMs },
        })
        await db.from('conversations').update({
          last_message_at: new Date().toISOString(),
          last_message_preview: result.reply.substring(0, 100),
          updated_at: new Date().toISOString(),
        }).eq('id', conversation.id)
      }
    } catch (err: any) {
      console.error('[webhook/autoReply]', err.message)
    }
  }
}

async function runLeadAnalysis(conversationId: string, contactId: string, db: any) {
  const { data: messages } = await db
    .from('messages')
    .select('content, direction, sender_type')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(10)

  if (!messages?.length) return null

  const aiMessages = messages
    .filter((m: any) => m.content)
    .map((m: any) => ({
      role: (m.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    }))

  const analysis = await analyzeLeadFromConversation(aiMessages, conversationId)

  const { data: existingLead } = await db.from('leads').select('id').eq('contact_id', contactId).single()
  const leadPatch = {
    intent: analysis.intent, budget: analysis.budget, urgency: analysis.urgency,
    sentiment: analysis.sentiment, ai_score: analysis.ai_score, confidence: analysis.confidence,
    ai_summary: analysis.summary, tags: analysis.suggested_tags, updated_at: new Date().toISOString(),
  }

  let leadId: string
  if (existingLead) {
    leadId = existingLead.id
    await db.from('leads').update(leadPatch).eq('id', leadId)
  } else {
    const { data: contactRow } = await db.from('contacts').select('name, phone').eq('id', contactId).single()
    const { data: newLead } = await db.from('leads').insert({
      contact_id: contactId, name: contactRow?.name ?? 'Unknown', phone: contactRow?.phone,
      stage: 'new', source: 'whatsapp', ...leadPatch,
    }).select('id').single()
    leadId = newLead?.id
    await db.from('conversations').update({ lead_id: leadId }).eq('id', conversationId)
  }

  await db.from('conversations').update({
    ai_score: analysis.ai_score, sentiment: analysis.sentiment, ai_summary: analysis.summary,
  }).eq('id', conversationId)

  if (analysis.create_task && analysis.task_title) {
    await db.from('tasks').insert({
      title: analysis.task_title, lead_id: leadId, conversation_id: conversationId,
      priority: analysis.urgency === 'high' ? 'urgent' : analysis.urgency === 'medium' ? 'high' : 'medium',
      due_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      ai_generated: true, ai_reasoning: `Lead score: ${analysis.ai_score}, Intent: ${analysis.intent}`,
    }).catch(() => {})
  }

  return { ...analysis, leadId }
}
