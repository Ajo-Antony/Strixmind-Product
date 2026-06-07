// app/api/ai/send-outreach/route.ts
// Generates a personalised convincing message from an AI agent and sends it to the lead's conversation

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServiceClient()
  const { agent_id, lead_id, custom_prompt } = await req.json()

  if (!agent_id || !lead_id) {
    return NextResponse.json({ error: 'agent_id and lead_id required' }, { status: 400 })
  }

  // ── 1. Fetch agent & lead ──────────────────────────────────────────────────
  const [agentRes, leadRes] = await Promise.all([
    supabase.from('agents').select('*').eq('id', agent_id).single(),
    supabase.from('leads').select('*, contact:contacts(*)').eq('id', lead_id).single(),
  ])

  if (agentRes.error || !agentRes.data) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }
  if (leadRes.error || !leadRes.data) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  const agent = agentRes.data
  const lead = leadRes.data

  // ── 2. Build a personalised prompt ────────────────────────────────────────
  const leadContext = `
Lead name: ${lead.name}
Phone: ${lead.phone}
Stage: ${lead.stage}
AI Score: ${lead.ai_score ?? 'unknown'}
Budget: ${lead.budget ? `₹${lead.budget.toLocaleString('en-IN')}` : 'not specified'}
Intent: ${lead.intent ?? 'not specified'}
Urgency: ${lead.urgency ?? 'not specified'}
Notes: ${lead.notes ?? 'none'}
Last contact: ${lead.updated_at ? new Date(lead.updated_at).toLocaleDateString('en-IN') : 'unknown'}
`

  const outreachInstruction = custom_prompt
    ? `\n\nSPECIFIC GOAL FOR THIS OUTREACH:\n${custom_prompt}`
    : `\n\nYour goal: Re-engage this lead warmly and guide them toward booking an in-store appointment or sharing more about their needs. Be personal — use their name. Be concise (2-4 sentences max).`

  const systemPrompt = `${agent.system_prompt}

You are now sending an OUTBOUND WhatsApp message to a specific lead. Write ONLY the message text — no preamble, no quotes, no explanation.

LEAD DETAILS:
${leadContext}
${outreachInstruction}

Rules:
- Address them by first name
- Reference something specific about their situation if available (budget, intent, urgency)
- Sound like a human, not a robot
- End with a soft call to action
- Keep it to 2-4 sentences
- WhatsApp formatting only (no markdown headers)
`

  // ── 3. Call AI provider ───────────────────────────────────────────────────
  let aiMessage = ''
  const startTime = Date.now()

  try {
    if (agent.provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: agent.model,
          max_tokens: agent.max_tokens ?? 300,
          temperature: agent.temperature ?? 0.7,
          system: systemPrompt,
          messages: [{ role: 'user', content: `Write the outreach WhatsApp message for ${lead.name}.` }],
        }),
      })
      const data = await response.json()
      aiMessage = data.content?.[0]?.text ?? ''
    } else if (agent.provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: agent.model,
          max_tokens: agent.max_tokens ?? 300,
          temperature: agent.temperature ?? 0.7,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Write the outreach WhatsApp message for ${lead.name}.` },
          ],
        }),
      })
      const data = await response.json()
      aiMessage = data.choices?.[0]?.message?.content ?? ''
    } else if (agent.provider === 'cohere') {
      const response = await fetch('https://api.cohere.com/v2/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
        },
        body: JSON.stringify({
          model: agent.model,
          max_tokens: agent.max_tokens ?? 300,
          temperature: agent.temperature ?? 0.7,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Write the outreach WhatsApp message for ${lead.name}.` },
          ],
        }),
      })
      const data = await response.json()
      aiMessage = data.message?.content?.[0]?.text ?? ''
    } else if (agent.provider === 'gemini') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${agent.model}:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt + '\n\nTask: Write the outreach WhatsApp message for ' + lead.name }] }],
            generationConfig: { maxOutputTokens: agent.max_tokens ?? 300, temperature: agent.temperature ?? 0.7 },
          }),
        }
      )
      const data = await response.json()
      aiMessage = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    }
  } catch (err: any) {
    return NextResponse.json({ error: `AI provider error: ${err.message}` }, { status: 502 })
  }

  if (!aiMessage.trim()) {
    return NextResponse.json({ error: 'AI returned empty message' }, { status: 500 })
  }

  const latency = Date.now() - startTime

  // ── 4. Find or create conversation for this lead ───────────────────────────
  let conversationId: string

  // Check if lead has a linked contact with an existing conversation
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .eq('contact_id', lead.contact_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingConv) {
    conversationId = existingConv.id
  } else if (lead.contact_id) {
    // Create a new conversation for this contact
    const { data: newConv, error: convErr } = await supabase
      .from('conversations')
      .insert({
        contact_id: lead.contact_id,
        status: 'open',
        priority: lead.urgency === 'high' ? 'urgent' : 'medium',
        ai_score: lead.ai_score,
        last_message_preview: aiMessage.slice(0, 80),
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      })
      .select('id')
      .single()

    if (convErr || !newConv) {
      return NextResponse.json({ error: 'Could not create conversation' }, { status: 500 })
    }
    conversationId = newConv.id
  } else {
    // Lead has no contact_id — create contact first
    const { data: newContact, error: contactErr } = await supabase
      .from('contacts')
      .insert({ name: lead.name, phone: lead.phone })
      .select('id')
      .single()

    if (contactErr || !newContact) {
      return NextResponse.json({ error: 'Could not create contact' }, { status: 500 })
    }

    // Link contact to lead
    await supabase.from('leads').update({ contact_id: newContact.id }).eq('id', lead_id)

    const { data: newConv, error: convErr } = await supabase
      .from('conversations')
      .insert({
        contact_id: newContact.id,
        status: 'open',
        priority: 'medium',
        ai_score: lead.ai_score,
        last_message_preview: aiMessage.slice(0, 80),
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      })
      .select('id')
      .single()

    if (convErr || !newConv) {
      return NextResponse.json({ error: 'Could not create conversation' }, { status: 500 })
    }
    conversationId = newConv.id
  }

  // ── 5. Insert message into conversation ───────────────────────────────────
  const { error: msgErr } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    content: aiMessage,
    direction: 'outbound',
    sender_type: 'ai',
    status: 'sent',
    type: 'text',
    wa_timestamp: new Date().toISOString(),
    metadata: {
      agent_id: agent.id,
      agent_name: agent.name,
      lead_id: lead_id,
      outreach: true,
      latency_ms: latency,
    },
  })

  if (msgErr) {
    return NextResponse.json({ error: 'Message insert failed' }, { status: 500 })
  }

  // Update conversation last message
  await supabase
    .from('conversations')
    .update({
      last_message_preview: aiMessage.slice(0, 80),
      last_message_at: new Date().toISOString(),
      status: 'open',
    })
    .eq('id', conversationId)

  // ── 6. Update lead stage to 'contacted' if still 'new' ───────────────────
  if (lead.stage === 'new') {
    await supabase.from('leads').update({ stage: 'contacted' }).eq('id', lead_id)
  }

  // ── 7. Log AI usage ───────────────────────────────────────────────────────
  try {
    await supabase.from('ai_logs' as any).insert({
      agent_id: agent.id,
      conversation_id: conversationId,
      request_type: 'outreach',
      status: 'success',
      latency_ms: latency,
      metadata: { lead_id, lead_name: lead.name },
    })
  } catch { /* non-critical log */ }

  return NextResponse.json({
    success: true,
    message: aiMessage,
    conversation_id: conversationId,
    latency_ms: latency,
  })
}