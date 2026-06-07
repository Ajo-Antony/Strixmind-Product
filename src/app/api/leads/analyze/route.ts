// POST /api/leads/analyze
// Runs AI lead qualification on demand for any lead.
// Called when:
//   - A lead is manually added (no WhatsApp conversation)
//   - A CSV-imported lead has never been scored
//   - The user clicks "Re-score" on a lead card
//   - Bulk re-scoring is triggered from the UI
//
// Body: { lead_id: string }
// Returns: { data: { ai_score, intent, urgency, sentiment, summary } }

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import { analyzeLeadFromConversation } from '@/lib/ai'

export async function POST(req: NextRequest) {
  const db = createSupabaseServiceClient()

  let lead_id: string
  try {
    const body = await req.json()
    lead_id = body.lead_id
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!lead_id) {
    return NextResponse.json({ error: 'lead_id is required' }, { status: 400 })
  }

  // 1. Fetch the lead with its contact and conversation history
  const { data: lead, error: leadErr } = await db
    .from('leads')
    .select('*, contact:contacts(name, phone)')
    .eq('id', lead_id)
    .single()

  if (leadErr || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // 2. Build message history from conversation if one exists
  let aiMessages: { role: 'user' | 'assistant'; content: string }[] = []

  const { data: conversation } = await db
    .from('conversations')
    .select('id')
    .eq('lead_id', lead_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (conversation) {
    const { data: messages } = await db
      .from('messages')
      .select('content, direction')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(20)

    aiMessages = (messages ?? [])
      .filter((m: any) => m.content && !m.content.startsWith('['))
      .map((m: any) => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant' as const,
        content: m.content,
      }))
  }

  // 3. If no conversation, synthesize context from lead fields
  // This handles manually-added leads and CSV imports.
  if (aiMessages.length === 0) {
    const parts: string[] = []
    const contactName = (lead.contact as any)?.name ?? lead.name ?? 'Customer'

    if (lead.notes)                           parts.push(`Customer notes: ${lead.notes}`)
    if (lead.intent)                          parts.push(`Known intent: ${lead.intent.replace(/_/g, ' ')}`)
    if (lead.budget)                          parts.push(`Budget: ₹${lead.budget}`)
    if (lead.urgency && lead.urgency !== 'low') parts.push(`Urgency: ${lead.urgency}`)
    if (lead.source)                          parts.push(`Lead source: ${lead.source}`)
    if (lead.stage && lead.stage !== 'new')   parts.push(`Pipeline stage: ${lead.stage}`)

    const syntheticMessage = parts.length > 0
      ? `[Lead profile for ${contactName}] ${parts.join('. ')}`
      : `[Lead profile for ${contactName}] New lead, no conversation history. Stage: ${lead.stage ?? 'new'}.`

    aiMessages = [{ role: 'user', content: syntheticMessage }]
  }

  // 4. Run AI analysis
  let analysis
  try {
    analysis = await analyzeLeadFromConversation(aiMessages, conversation?.id, lead_id)
  } catch (err: any) {
    return NextResponse.json({ error: `AI analysis failed: ${err.message}` }, { status: 500 })
  }

  // 5. Persist score to lead
  const patch = {
    ai_score:   analysis.ai_score,
    confidence: analysis.confidence,
    intent:     analysis.intent,
    urgency:    analysis.urgency,
    sentiment:  analysis.sentiment,
    ai_summary: analysis.summary,
    tags:       analysis.suggested_tags?.length ? analysis.suggested_tags : lead.tags,
    updated_at: new Date().toISOString(),
  }

  const { data: updated, error: updateErr } = await db
    .from('leads').update(patch).eq('id', lead_id).select().single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // 6. Sync to linked conversation if one exists
  if (conversation) {
    await db.from('conversations').update({
      ai_score:   analysis.ai_score,
      sentiment:  analysis.sentiment,
      ai_summary: analysis.summary,
      updated_at: new Date().toISOString(),
    }).eq('id', conversation.id)
  }

  // 7. Auto-create follow-up task if AI recommends it
  if (analysis.create_task && analysis.task_title) {
    await db.from('tasks').insert({
      title:           analysis.task_title,
      lead_id,
      conversation_id: conversation?.id ?? null,
      priority:        analysis.urgency === 'high' ? 'urgent' : analysis.urgency === 'medium' ? 'high' : 'medium',
      due_date:        new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      ai_generated:    true,
      ai_reasoning:    `AI score: ${analysis.ai_score}/100, Intent: ${analysis.intent}`,
    })
  }

  return NextResponse.json({
    data: {
      ai_score:   analysis.ai_score,
      intent:     analysis.intent,
      urgency:    analysis.urgency,
      sentiment:  analysis.sentiment,
      summary:    analysis.summary,
      confidence: analysis.confidence,
      lead:       updated,
    },
  })
}
