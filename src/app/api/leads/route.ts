import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import { analyzeLeadFromConversation, callAI } from '@/lib/ai'

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

    // Fetch existing metadata to avoid overwriting unrelated custom metadata
    const { data: currentLead } = await db.from('leads').select('metadata').eq('id', leadId).single()

    await db.from('leads').update({
      ai_score:   analysis.ai_score,
      intent:     analysis.intent,
      urgency:    analysis.urgency,
      sentiment:  analysis.sentiment,
      confidence: analysis.confidence,
      ai_summary: analysis.summary,
      tags:       analysis.suggested_tags,
      metadata: {
        ...(currentLead?.metadata ?? {}),
        is_genuine: analysis.is_genuine ?? true,
        genuineness_score: analysis.genuineness_score ?? 100,
        genuineness_reasoning: analysis.genuineness_reasoning ?? 'Genuine lead',
        recommended_next_followup_hours: analysis.recommended_next_followup_hours ?? 24,
        followup_message_draft: analysis.followup_message_draft ?? '',
        scheduled_followup_at: new Date(Date.now() + (analysis.recommended_next_followup_hours ?? 24) * 3600_000).toISOString(),
        followup_sent: false,
      },
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

export async function PUT(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { leadId } = await req.json()
  if (!leadId) return NextResponse.json({ error: 'Missing leadId' }, { status: 400 })

  const { data: lead } = await db.from('leads').select('*').eq('id', leadId).single()
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  let conversationHistory = ''
  try {
    const { data: conv } = await db
      .from('conversations')
      .select('id')
      .eq('contact_id', lead.contact_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (conv?.id) {
      const { data: messages } = await db
        .from('messages')
        .select('content, direction')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true })
        .limit(10)
      conversationHistory = (messages ?? [])
        .map((m: any) => `${m.direction === 'inbound' ? 'Customer' : 'AI'}: ${m.content}`)
        .join('\n')
    }
  } catch { /* skip non-critical history fetch error */ }

  const prompt = `You are an expert sales follow-up AI. Based on the following customer details and conversation history, write a tailored, hyper-personalized, warm WhatsApp follow-up message (2-3 sentences max) to re-engage them. Offer value or address their goals/interests directly. Avoid generic templates, make it feel authentic and personal. No markdown or asterisks.

Customer Name: ${lead.name}
Interest/Intent: ${lead.intent || 'not specified'}
Budget: ${lead.budget ? `₹${lead.budget}` : 'not specified'}
Notes/Summary: ${lead.ai_summary || ''}

Conversation History:
${conversationHistory || 'No past messages.'}
`

  try {
    const response = await callAI({
      systemPrompt: 'You are a warm, professional, hyper-personalized CRM follow-up bot. Respond with only the text of the follow-up message.',
      messages: [{ role: 'user', content: prompt }],
      taskType: 'chat',
      size: 'small',
      leadId,
    })

    const draft = response.text?.trim() || `Hi ${lead.name}! Just checking in to see if you have any questions about our premium collections. We're here to help!`

    const updatedMeta = {
      ...(lead.metadata ?? {}),
      followup_message_draft: draft,
      followup_sent: false,
    }

    await db.from('leads').update({
      metadata: updatedMeta,
      updated_at: new Date().toISOString(),
    }).eq('id', leadId)

    return NextResponse.json({ data: { draft } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
