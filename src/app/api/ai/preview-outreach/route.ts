// app/api/ai/preview-outreach/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServiceClient()
  const { agent_id, lead, custom_prompt } = await req.json()

  if (!agent_id || !lead) {
    return NextResponse.json({ error: 'agent_id and lead required' }, { status: 400 })
  }

  // Try both table names — 'agents' and 'ai_agents'
  let agent: any = null
  const { data: a1 } = await supabase.from('agents').select('*').eq('id', agent_id).maybeSingle()
  if (a1) {
    agent = a1
  } else {
    const { data: a2 } = await supabase.from('ai_agents').select('*').eq('id', agent_id).maybeSingle()
    agent = a2
  }

  if (!agent) {
    // Log what agent_ids exist so we can debug
    const { data: allAgents } = await supabase.from('agents').select('id, name').limit(5)
    const { data: allAiAgents } = await supabase.from('ai_agents').select('id, name').limit(5)
    console.error('[preview-outreach] Agent not found. agent_id:', agent_id)
    console.error('[preview-outreach] agents table:', allAgents)
    console.error('[preview-outreach] ai_agents table:', allAiAgents)
    return NextResponse.json({
      error: `Agent not found. Received id: ${agent_id}`,
      debug: { agents: allAgents, ai_agents: allAiAgents }
    }, { status: 404 })
  }

  const outreachInstruction = custom_prompt
    ? `\n\nSPECIFIC GOAL FOR THIS OUTREACH:\n${custom_prompt}`
    : `\n\nYour goal: Re-engage this lead warmly and guide them toward booking an in-store appointment or sharing more about their needs. Be personal — use their name. Be concise (2-4 sentences max).`

  const systemPrompt = `${agent.system_prompt}

You are now writing an OUTBOUND WhatsApp message. Write ONLY the message text.

Lead name: ${lead.name}
Stage: ${lead.stage}
AI Score: ${lead.ai_score ?? 'unknown'}
Budget: ${lead.budget ? `₹${Number(lead.budget).toLocaleString('en-IN')}` : 'not specified'}
Intent: ${lead.intent ?? 'not specified'}
${outreachInstruction}

Rules: Address by first name. 2-4 sentences. Sound human. Soft CTA at end.`

  let previewMessage = ''

  try {
    const provider = agent.provider?.toLowerCase()

    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: agent.model,
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: 'user', content: 'Write the outreach message.' }],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data))
      previewMessage = data.content?.[0]?.text ?? ''

    } else if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: agent.model,
          max_tokens: 300,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Write the outreach message.' },
          ],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data))
      previewMessage = data.choices?.[0]?.message?.content ?? ''

    } else if (provider === 'cohere') {
      const res = await fetch('https://api.cohere.com/v2/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.COHERE_API_KEY}` },
        body: JSON.stringify({
          model: agent.model,
          max_tokens: 300,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Write the outreach message.' },
          ],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data))
      previewMessage = data.message?.content?.[0]?.text ?? ''

    } else if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${agent.model}:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt + '\n\nWrite the outreach message.' }] }],
            generationConfig: { maxOutputTokens: 300 },
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data))
      previewMessage = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    } else {
      return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[preview-outreach] AI call failed:', err.message)
    return NextResponse.json({ error: err.message }, { status: 502 })
  }

  if (!previewMessage.trim()) {
    return NextResponse.json({ error: 'AI returned empty message' }, { status: 500 })
  }

  return NextResponse.json({ message: previewMessage.trim() })
}