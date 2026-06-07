import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import { analyzeLeadFromConversation } from '@/lib/ai'

/**
 * POST /api/leads/score
 * Score (or re-score) a lead using AI.
 *
 * Body: { lead_id: string }
 *
 * - If the lead has a linked conversation, we use the real message history.
 * - If not (manually added lead), we build a synthetic one-turn conversation
 *   from the stored lead fields so the AI still produces a meaningful score.
 */
export async function POST(req: NextRequest) {
  const db = createSupabaseServiceClient()

  let lead_id: string
  try {
    const body = await req.json()
    lead_id = body.lead_id
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

  // 1. Fetch the lead
  const { data: lead, error: leadErr } = await db
    .from('leads')
    .select('*, contact:contacts(id, name, phone)')
    .eq('id', lead_id)
    .single()

  if (leadErr || !lead) {
    return NextResponse.json({ error: leadErr?.message ?? 'Lead not found' }, { status: 404 })
  }

  // 2. Try to get real conversation messages
  let messages: { role: 'user' | 'assistant'; content: string }[] = []

  if (lead.contact_id) {
    const { data: convs } = await db
      .from('conversations')
      .select('id')
      .eq('contact_id', lead.contact_id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (convs && convs.length > 0) {
      const { data: msgs } = await db
        .from('messages')
        .select('content, direction')
        .eq('conversation_id', convs[0].id)
        .order('created_at', { ascending: true })
        .limit(15)

      if (msgs && msgs.length > 0) {
        messages = msgs
          .filter((m: any) => m.content)
          .map((m: any) => ({
            role: (m.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content,
          }))
      }
    }
  }

  // 3. Fall back: build a synthetic message from lead fields
  if (messages.length === 0) {
    const parts: string[] = []
    const name = lead.name ?? lead.contact?.name ?? 'Customer'
    parts.push(`My name is ${name}.`)
    if (lead.phone) parts.push(`Phone: ${lead.phone}.`)
    if (lead.email) parts.push(`Email: ${lead.email}.`)
    if (lead.budget) parts.push(`Budget: ₹${lead.budget}.`)
    if (lead.intent) parts.push(`I am interested in: ${lead.intent.replace(/_/g, ' ')}.`)
    if (lead.notes) parts.push(`Notes: ${lead.notes}.`)
    if (lead.urgency && lead.urgency !== 'low') parts.push(`Urgency: ${lead.urgency}.`)
    if (lead.stage && lead.stage !== 'new') parts.push(`Current pipeline stage: ${lead.stage}.`)
    if (lead.source) parts.push(`Source: ${lead.source}.`)

    messages = [{ role: 'user', content: parts.join(' ') || `New lead: ${lead.name}` }]
  }

  // 4. Run AI analysis
  let analysis
  try {
    analysis = await analyzeLeadFromConversation(messages, undefined, lead_id)
  } catch (err: any) {
    return NextResponse.json({ error: `AI analysis failed: ${err.message}` }, { status: 500 })
  }

  // 5. Persist results back to the lead
  const patch = {
    ai_score:   analysis.ai_score,
    intent:     analysis.intent,
    urgency:    analysis.urgency,
    sentiment:  analysis.sentiment,
    confidence: analysis.confidence,
    ai_summary: analysis.summary,
    tags:       analysis.suggested_tags,
    budget:     analysis.budget ?? lead.budget,
    updated_at: new Date().toISOString(),
  }

  const { data: updated, error: updateErr } = await db
    .from('leads')
    .update(patch)
    .eq('id', lead_id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // 6. Auto-create a follow-up task if the AI recommends it
  if (analysis.create_task && analysis.task_title) {
    try {
      await db.from('tasks').insert({
        title: analysis.task_title,
        lead_id,
        priority: analysis.urgency === 'high' ? 'urgent' : analysis.urgency === 'medium' ? 'high' : 'medium',
        due_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        ai_generated: true,
        ai_reasoning: `Lead score: ${analysis.ai_score}, Intent: ${analysis.intent}`,
      })
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ data: updated })
}
