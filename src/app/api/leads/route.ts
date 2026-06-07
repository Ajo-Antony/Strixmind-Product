import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import { analyzeLeadFromConversation } from '@/lib/ai'

// ─── Helper: fire-and-forget AI scoring for a new lead ───────────────────────
async function scoreNewLead(leadId: string, lead: any, db: any) {
  try {
    const parts: string[] = []
    const name = lead.name ?? 'Customer'
    parts.push(`My name is ${name}.`)
    if (lead.phone) parts.push(`Phone: ${lead.phone}.`)
    if (lead.email) parts.push(`Email: ${lead.email}.`)
    if (lead.budget) parts.push(`Budget: ₹${lead.budget}.`)
    if (lead.notes) parts.push(`Notes: ${lead.notes}.`)
    if (lead.stage && lead.stage !== 'new') parts.push(`Stage: ${lead.stage}.`)

    const messages = [{ role: 'user' as const, content: parts.join(' ') || `New lead: ${name}` }]
    const analysis = await analyzeLeadFromConversation(messages, undefined, leadId)

    await db.from('leads').update({
      ai_score:   analysis.ai_score,
      intent:     analysis.intent,
      urgency:    analysis.urgency,
      sentiment:  analysis.sentiment,
      confidence: analysis.confidence,
      ai_summary: analysis.summary,
      tags:       analysis.suggested_tags,
      updated_at: new Date().toISOString(),
    }).eq('id', leadId)

    if (analysis.create_task && analysis.task_title) {
      await db.from('tasks').insert({
        title: analysis.task_title,
        lead_id: leadId,
        priority: analysis.urgency === 'high' ? 'urgent' : analysis.urgency === 'medium' ? 'high' : 'medium',
        due_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        ai_generated: true,
        ai_reasoning: `Auto-scored on creation. Score: ${analysis.ai_score}, Intent: ${analysis.intent}`,
      }).catch(() => {})
    }
  } catch (err: any) {
    console.error('[scoreNewLead] AI scoring failed:', err.message)
  }
}

export async function GET(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const stage = searchParams.get('stage')
  const search = searchParams.get('search')

  let query = db
    .from('leads')
    .select('*, contact:contacts(id, phone, email, avatar_url)')
    .order('ai_score', { ascending: false })

  if (stage) query = query.eq('stage', stage)
  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const body = await req.json()

  const { data, error } = await db
    .from('leads')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire-and-forget AI scoring in background
  scoreNewLead(data.id, data, db).catch(() => {})

  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data, error } = await db
    .from('leads')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await db.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
