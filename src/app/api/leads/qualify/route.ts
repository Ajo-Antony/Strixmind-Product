/**
 * POST /api/leads/qualify
 *
 * Full 7-stage lead qualification pipeline:
 *   Contact → Lead Created → Lead Enrichment → AI Qualification
 *   → Intent Detection → Lead Score → Pipeline Assignment
 *
 * Also runs: budget detection, purchase intent, urgency detection,
 * sentiment analysis on every pass.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai'

// ── Stage types ───────────────────────────────────────────────────────────────
type QualStage =
  | 'contact_resolved'
  | 'lead_created'
  | 'enrichment'
  | 'ai_qualification'
  | 'intent_detection'
  | 'lead_scored'
  | 'pipeline_assigned'

interface QualificationResult {
  lead_id: string
  stages_completed: QualStage[]
  duration_ms: number
  // Enriched fields
  budget_detected: number | null
  budget_range: string | null
  purchase_intent: 'buying' | 'browsing' | 'gifting' | 'researching' | 'unknown'
  intent_confidence: number
  urgency: 'low' | 'medium' | 'high' | 'immediate'
  urgency_signals: string[]
  sentiment: 'positive' | 'neutral' | 'negative'
  sentiment_score: number          // -1 to +1
  ai_score: number                 // 0-100
  pipeline_stage: string
  pipeline_reason: string
  qualification_summary: string
  next_action: string
  tags: string[]
}

// ── Pipeline stage logic ──────────────────────────────────────────────────────
async function runQualificationPipeline(
  leadId: string,
  conversationId: string | null,
  db: any
): Promise<QualificationResult> {
  const start = Date.now()
  const stages: QualStage[] = []

  // ── STAGE 1: Contact resolved ─────────────────────────────────────────────
  const { data: lead, error: leadErr } = await db
    .from('leads')
    .select('*, contact:contacts(id, name, phone, email, tags, custom_fields, created_at)')
    .eq('id', leadId)
    .single()

  if (leadErr || !lead) throw new Error(`Lead ${leadId} not found`)
  stages.push('contact_resolved')

  // ── STAGE 2: Lead created / verified ─────────────────────────────────────
  stages.push('lead_created')

  // ── STAGE 3: Enrichment — gather all conversation signals ─────────────────
  let conversationText = ''
  let messageCount = 0

  const targetConvId = conversationId ?? lead.conversation_id

  if (targetConvId) {
    const { data: messages } = await db
      .from('messages')
      .select('content, direction, created_at')
      .eq('conversation_id', targetConvId)
      .order('created_at', { ascending: true })
      .limit(30)

    if (messages?.length) {
      messageCount = messages.length
      conversationText = messages
        .filter((m: any) => m.content)
        .map((m: any) => `${m.direction === 'inbound' ? 'Customer' : 'Agent'}: ${m.content}`)
        .join('\n')
    }
  }

  // Fallback: build from lead fields
  if (!conversationText) {
    const parts: string[] = []
    if (lead.name) parts.push(`Name: ${lead.name}`)
    if (lead.budget) parts.push(`Stated budget: ₹${lead.budget}`)
    if (lead.notes) parts.push(`Notes: ${lead.notes}`)
    if (lead.intent) parts.push(`Intent: ${lead.intent}`)
    conversationText = parts.join('. ') || 'New lead with no conversation history.'
  }

  stages.push('enrichment')

  // ── STAGE 4 + 5 + 6: AI qualification, intent detection, scoring ──────────
  const SYSTEM_PROMPT = `You are an expert lead qualification AI for a premium bridal & fashion boutique.

Analyze this conversation/lead data and return ONLY valid JSON — no markdown, no explanation.

Required JSON structure:
{
  "budget_detected": <number in INR or null>,
  "budget_range": "<'under_10k'|'10k_25k'|'25k_50k'|'50k_100k'|'above_100k'|null>",
  "purchase_intent": "<'buying'|'browsing'|'gifting'|'researching'|'unknown'>",
  "intent_confidence": <0.0-1.0>,
  "urgency": "<'low'|'medium'|'high'|'immediate'>",
  "urgency_signals": ["<list of signals found, e.g. 'wedding in 2 weeks'>"],
  "sentiment": "<'positive'|'neutral'|'negative'>",
  "sentiment_score": <-1.0 to 1.0>,
  "ai_score": <0-100>,
  "pipeline_stage": "<'new'|'qualified'|'contacted'|'scheduled'|'negotiation'|'converted'|'closed'>",
  "pipeline_reason": "<one sentence why>",
  "qualification_summary": "<2-3 sentence summary>",
  "next_action": "<specific recommended next action>",
  "tags": ["<relevant tags like 'high_value', 'bridal', 'urgent', 'budget_conscious'>"]
}

Scoring guide (ai_score 0-100):
- 0-20: Casual browser, no intent signals
- 21-40: Some interest, vague timeline
- 41-60: Clear interest, budget mentioned or implied
- 61-80: Strong intent, timeline within 3 months
- 81-100: Ready to buy, urgent, high budget

Budget detection: Extract from statements like "budget hai 15 hazaar", "around 20k", "₹50,000 max".
Purchase intent signals: "want to buy", "need for wedding", "getting married", "looking for".
Urgency signals: "wedding next month", "event this weekend", "urgent", "asap", "by [date]".
Sentiment: Based on message tone, excitement, frustration, or neutrality.`

  const { text: rawJson } = await callAI({
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: conversationText }],
    temperature: 0.1,
    maxTokens: 600,
    taskType: 'lead_qualification',
    responseFormat: 'json',
    size: 'large',
    leadId,
    conversationId: targetConvId,
  })

  let qualification: any
  try {
    const clean = rawJson.replace(/```json|```/g, '').trim()
    qualification = JSON.parse(clean)
  } catch {
    qualification = {
      budget_detected: lead.budget ?? null,
      budget_range: null,
      purchase_intent: 'unknown',
      intent_confidence: 0.5,
      urgency: lead.urgency ?? 'low',
      urgency_signals: [],
      sentiment: lead.sentiment ?? 'neutral',
      sentiment_score: 0,
      ai_score: lead.ai_score ?? 30,
      pipeline_stage: lead.stage ?? 'new',
      pipeline_reason: 'AI parse error — used existing lead data',
      qualification_summary: lead.ai_summary ?? 'No summary available.',
      next_action: 'Manual review required',
      tags: lead.tags ?? [],
    }
  }

  stages.push('ai_qualification')
  stages.push('intent_detection')
  stages.push('lead_scored')

  // ── STAGE 7: Pipeline assignment ─────────────────────────────────────────
  await db.from('leads').update({
    budget:          qualification.budget_detected,
    intent:          qualification.purchase_intent,
    urgency:         qualification.urgency,
    sentiment:       qualification.sentiment,
    ai_score:        qualification.ai_score,
    confidence:      qualification.intent_confidence,
    stage:           qualification.pipeline_stage,
    ai_summary:      qualification.qualification_summary,
    tags:            qualification.tags,
    metadata: {
      budget_range:      qualification.budget_range,
      urgency_signals:   qualification.urgency_signals,
      sentiment_score:   qualification.sentiment_score,
      pipeline_reason:   qualification.pipeline_reason,
      next_action:       qualification.next_action,
      message_count:     messageCount,
      qualified_at:      new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  }).eq('id', leadId)

  stages.push('pipeline_assigned')

  // Auto-create task if high value
  if (qualification.ai_score >= 70 || qualification.urgency === 'immediate' || qualification.urgency === 'high') {
    await db.from('tasks').insert({
      title: `${qualification.next_action} — ${lead.name ?? 'Lead'}`,
      lead_id: leadId,
      priority: qualification.urgency === 'immediate' ? 'urgent'
               : qualification.urgency === 'high' ? 'high' : 'medium',
      due_date: new Date(Date.now() + (qualification.urgency === 'immediate' ? 0.5 : 2) * 3600_000).toISOString(),
      ai_generated: true,
      ai_reasoning: `Score: ${qualification.ai_score}, Intent: ${qualification.purchase_intent}, Urgency: ${qualification.urgency}`,
      status: 'pending',
    }).catch(() => {})
  }

  return {
    lead_id:              leadId,
    stages_completed:     stages,
    duration_ms:          Date.now() - start,
    budget_detected:      qualification.budget_detected,
    budget_range:         qualification.budget_range,
    purchase_intent:      qualification.purchase_intent,
    intent_confidence:    qualification.intent_confidence,
    urgency:              qualification.urgency,
    urgency_signals:      qualification.urgency_signals,
    sentiment:            qualification.sentiment,
    sentiment_score:      qualification.sentiment_score,
    ai_score:             qualification.ai_score,
    pipeline_stage:       qualification.pipeline_stage,
    pipeline_reason:      qualification.pipeline_reason,
    qualification_summary: qualification.qualification_summary,
    next_action:          qualification.next_action,
    tags:                 qualification.tags,
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const db = createSupabaseServiceClient()
  try {
    const { lead_id, conversation_id } = await req.json()
    if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })
    const result = await runQualificationPipeline(lead_id, conversation_id ?? null, db)
    return NextResponse.json({ data: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Bulk qualify — all unscored leads
export async function GET(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const limit = Number(searchParams.get('limit') ?? '20')

  const { data: leads } = await db
    .from('leads')
    .select('id, conversation_id')
    .is('ai_score', null)
    .limit(limit)

  if (!leads?.length) return NextResponse.json({ data: [], message: 'All leads already scored' })

  const results = []
  for (const lead of leads) {
    try {
      const r = await runQualificationPipeline(lead.id, lead.conversation_id, db)
      results.push({ lead_id: lead.id, success: true, score: r.ai_score, stage: r.pipeline_stage })
    } catch (err: any) {
      results.push({ lead_id: lead.id, success: false, error: err.message })
    }
  }
  return NextResponse.json({ data: results, total: results.length })
}
