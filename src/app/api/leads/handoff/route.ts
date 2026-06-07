/**
 * POST /api/leads/handoff
 *
 * Human Handoff Flow:
 *   AI Reply → Confidence Check → Low Confidence? → Assign Human Agent
 *   → Human Reply → Conversation Resume
 *
 * Called after orchestrator produces a reply to check if it should
 * be sent automatically or routed to a human agent.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai'
import { sendTextMessage } from '@/lib/whatsapp'

// ── Confidence thresholds ─────────────────────────────────────────────────────
const CONFIDENCE_THRESHOLD = 0.72   // below this → human handoff
const SENTIMENT_BLOCK     = 'negative'  // always hand off negative sentiment
const URGENCY_ESCALATE    = ['immediate', 'high'] // always escalate these

// ── Handoff reasons ───────────────────────────────────────────────────────────
type HandoffReason =
  | 'low_confidence'
  | 'negative_sentiment'
  | 'high_urgency'
  | 'explicit_human_request'
  | 'complex_query'
  | 'payment_query'
  | 'complaint'

interface HandoffDecision {
  should_handoff: boolean
  reason?: HandoffReason
  confidence_score: number
  assigned_agent_id?: string
  assigned_agent_name?: string
  handoff_message?: string   // message sent to customer when handing off
  ai_reply?: string          // set when no handoff needed
}

// ── Analyse whether handoff is needed ────────────────────────────────────────
async function analyseHandoff(
  draftReply: string,
  userMessage: string,
  conversationId: string,
  db: any
): Promise<HandoffDecision> {

  // 1. Fetch conversation context
  const { data: conv } = await db
    .from('conversations')
    .select('sentiment, ai_score, priority, lead:leads(urgency, intent)')
    .eq('id', conversationId)
    .single()

  const urgency = (conv?.lead as any)?.urgency ?? 'low'
  const sentiment = conv?.sentiment ?? 'neutral'

  // 2. Check hard rules first
  const lowerMsg = userMessage.toLowerCase()
  const wantsHuman =
    lowerMsg.includes('human') || lowerMsg.includes('agent') ||
    lowerMsg.includes('speak to someone') || lowerMsg.includes('real person') ||
    lowerMsg.includes('manager') || lowerMsg.includes('complaint')

  if (wantsHuman) {
    return { should_handoff: true, reason: 'explicit_human_request', confidence_score: 1.0 }
  }

  if (sentiment === SENTIMENT_BLOCK) {
    return { should_handoff: true, reason: 'negative_sentiment', confidence_score: 0.9 }
  }

  if (URGENCY_ESCALATE.includes(urgency)) {
    return { should_handoff: true, reason: 'high_urgency', confidence_score: 0.85 }
  }

  // 3. AI confidence check on the draft reply
  const { text: rawJson } = await callAI({
    systemPrompt: `You are a quality gate for an AI customer service system. Evaluate if this AI-drafted reply is good enough to send automatically, or if a human agent should handle it.

Respond ONLY with JSON:
{
  "confidence": <0.0-1.0>,
  "should_handoff": <true/false>,
  "reason": "<low_confidence|complex_query|payment_query|complaint|null>",
  "issues": ["<specific issues if any>"]
}

Hand off when:
- Customer asks about payments, refunds, or complaints
- Query is highly specific (measurements, custom orders, specific dates)
- Draft reply seems generic or unhelpful
- Multiple questions in one message`,
    messages: [{
      role: 'user',
      content: `Customer message: "${userMessage}"\n\nAI draft reply: "${draftReply}"`,
    }],
    temperature: 0.1,
    maxTokens: 200,
    taskType: 'handoff_check',
    responseFormat: 'json',
    size: 'small',
    conversationId,
  })

  let parsed: any = { confidence: 0.8, should_handoff: false }
  try {
    parsed = JSON.parse(rawJson.replace(/```json|```/g, '').trim())
  } catch { /* keep defaults */ }

  if (!parsed.should_handoff && parsed.confidence >= CONFIDENCE_THRESHOLD) {
    return {
      should_handoff: false,
      confidence_score: parsed.confidence,
      ai_reply: draftReply,
    }
  }

  return {
    should_handoff: true,
    reason: (parsed.reason as HandoffReason) ?? 'low_confidence',
    confidence_score: parsed.confidence,
  }
}

// ── Assign best available human agent ────────────────────────────────────────
async function assignAgent(conversationId: string, reason: HandoffReason, db: any) {
  // Pick least-loaded online team member
  const { data: agents } = await db
    .from('team_members')
    .select('id, name, open_conversation_count')
    .eq('status', 'online')
    .order('open_conversation_count', { ascending: true })
    .limit(1)

  const agent = agents?.[0]
  if (!agent) return null

  // Assign the conversation
  await db.from('conversations').update({
    assigned_to:    agent.id,
    ai_auto_reply:  false,          // pause AI auto-reply
    status:         'waiting',
    priority:       reason === 'high_urgency' || reason === 'explicit_human_request' ? 'urgent' : 'high',
    updated_at:     new Date().toISOString(),
  }).eq('id', conversationId)

  // Increment agent's open count
  await db.from('team_members').update({
    open_conversation_count: (agent.open_conversation_count ?? 0) + 1,
  }).eq('id', agent.id)

  // Log handoff event
  await db.from('messages').insert({
    conversation_id: conversationId,
    direction:       'outbound',
    sender_type:     'system',
    sender_name:     'System',
    type:            'text',
    content:         `[System] Conversation assigned to ${agent.name}. Reason: ${reason.replace(/_/g, ' ')}.`,
    status:          'sent',
    metadata:        { system: true, handoff: true, reason, agent_id: agent.id },
    created_at:      new Date().toISOString(),
  })

  // Create urgent task for the assigned agent
  const { data: conv } = await db.from('conversations').select('lead_id, contact:contacts(name)').eq('id', conversationId).single()
  if (conv?.lead_id) {
    await db.from('tasks').insert({
      title:        `[HANDOFF] Reply to ${(conv.contact as any)?.name ?? 'customer'} — ${reason.replace(/_/g, ' ')}`,
      lead_id:      conv.lead_id,
      priority:     'urgent',
      due_date:     new Date(Date.now() + 15 * 60_000).toISOString(), // 15 min SLA
      ai_generated: true,
      ai_reasoning: `Human handoff triggered. Reason: ${reason}`,
      status:       'pending',
    }).catch(() => {})
  }

  // Internal notification to agent (WhatsApp or push — plug in your notif system)
  await db.from('notifications').insert({
    type:       'handoff_assigned',
    title:      'New conversation assigned',
    body:       `Customer needs human attention. Reason: ${reason.replace(/_/g, ' ')}`,
    recipient:  agent.id,
    metadata:   { conversation_id: conversationId, reason },
    read:       false,
    created_at: new Date().toISOString(),
  }).catch(() => {})

  return agent
}

// ── Route: POST /api/leads/handoff ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const db = createSupabaseServiceClient()
  try {
    const { conversation_id, draft_reply, user_message, contact_phone } = await req.json()
    if (!conversation_id || !draft_reply || !user_message) {
      return NextResponse.json({ error: 'conversation_id, draft_reply and user_message required' }, { status: 400 })
    }

    const decision = await analyseHandoff(draft_reply, user_message, conversation_id, db)

    if (decision.should_handoff) {
      const agent = await assignAgent(conversation_id, decision.reason!, db)

      // Send polite handoff message to customer via WhatsApp
      const handoffMsg = decision.reason === 'explicit_human_request'
        ? `Of course! I'm connecting you with a team member right now. Please hold on for a moment. 🙏`
        : `I want to make sure you get the best help possible. I'm connecting you with one of our specialists right away. They'll be with you shortly! 🌟`

      if (contact_phone) {
        await sendTextMessage(contact_phone, handoffMsg).catch(() => {})
      }

      try {
        await db.from('messages').insert({
          conversation_id,
          direction:   'outbound',
          sender_type: 'ai',
          sender_name: 'StrixMind AI',
          type:        'text',
          content:     handoffMsg,
          status:      'sent',
          metadata:    { handoff_message: true },
          created_at:  new Date().toISOString(),
        })
      } catch { /* non-critical */ }

      return NextResponse.json({
        data: {
          handoff: true,
          reason: decision.reason,
          confidence_score: decision.confidence_score,
          assigned_agent: agent ? { id: agent.id, name: agent.name } : null,
          handoff_message: handoffMsg,
        }
      })
    }

    // No handoff — safe to send AI reply
    return NextResponse.json({
      data: {
        handoff: false,
        confidence_score: decision.confidence_score,
        ai_reply: decision.ai_reply,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── Route: PATCH — human marks conversation resolved, re-enable AI ────────────
export async function PATCH(req: NextRequest) {
  const db = createSupabaseServiceClient()
  try {
    const { conversation_id, resume_ai } = await req.json()
    if (!conversation_id) return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })

    await db.from('conversations').update({
      ai_auto_reply:  resume_ai ?? false,
      status:         'open',
      assigned_to:    null,
      updated_at:     new Date().toISOString(),
    }).eq('id', conversation_id)

    if (resume_ai) {
      try {
        await db.from('messages').insert({
          conversation_id,
          direction:   'outbound',
          sender_type: 'system',
          sender_name: 'System',
          type:        'text',
          content:     '[System] AI auto-reply resumed.',
          status:      'sent',
          metadata:    { system: true, resumed: true },
          created_at:  new Date().toISOString(),
        })
      } catch { /* non-critical */ }
    }

    return NextResponse.json({ data: { resumed: true, ai_enabled: resume_ai ?? false } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
