import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai'

export async function GET() {
  const db = createSupabaseServiceClient()
  const { data, error } = await db.from('agents').select('*').order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const body = await req.json()
  const { data, error } = await db.from('agents').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const body = await req.json()
  const { id, ...updates } = body
  const { data, error } = await db
    .from('agents')
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
  const { error } = await db.from('agents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PUT /api/agents — test an agent
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { system_prompt, provider, model, temperature, test_message } = body

  const result = await callAI({
    provider,
    model,
    systemPrompt: system_prompt,
    messages: [{ role: 'user', content: test_message ?? 'Hello, I am interested in your products.' }],
    temperature: temperature ?? 0.7,
    maxTokens: 500,
    taskType: 'agent_test',
  })

  return NextResponse.json({ data: { response: result.text, provider: result.provider, model: result.model, tokens: result.promptTokens + result.completionTokens, latency: result.latencyMs } })
}
