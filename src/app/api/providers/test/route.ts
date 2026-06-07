// ─── /api/providers/test ─────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { testCohereConnection } from '@/lib/ai/providers/cohere'

export async function POST(req: NextRequest) {
  try {
    const { provider, api_key, model } = await req.json()

    if (!provider || !api_key) {
      return NextResponse.json({ error: 'provider and api_key are required' }, { status: 400 })
    }

    let result: { success: boolean; latencyMs: number; error?: string; response?: string }

    switch (provider) {
      case 'cohere':
        result = await testCohereConnection(api_key, model ?? 'command-r')
        break

      case 'openai': {
        const start = Date.now()
        try {
          const { OpenAI } = await import('openai')
          const client = new OpenAI({ apiKey: api_key })
          const completion = await client.chat.completions.create({
            model: model ?? 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Reply with exactly: "Connection successful"' }],
            max_tokens: 20,
          })
          result = {
            success: true,
            latencyMs: Date.now() - start,
            response: completion.choices[0].message.content ?? '',
          }
        } catch (err: any) {
          result = { success: false, latencyMs: Date.now() - start, error: err.message }
        }
        break
      }

      case 'anthropic': {
        const start = Date.now()
        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': api_key,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: model ?? 'claude-haiku-4-5-20251001',
              max_tokens: 20,
              messages: [{ role: 'user', content: 'Reply with exactly: "Connection successful"' }],
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error?.message ?? 'Anthropic error')
          result = { success: true, latencyMs: Date.now() - start, response: data.content[0].text }
        } catch (err: any) {
          result = { success: false, latencyMs: Date.now() - start, error: err.message }
        }
        break
      }

      case 'gemini': {
        const start = Date.now()
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model ?? 'gemini-1.5-flash'}:generateContent?key=${api_key}`
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: "Connection successful"' }] }],
              generationConfig: { maxOutputTokens: 20 },
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error?.message ?? 'Gemini error')
          result = {
            success: true,
            latencyMs: Date.now() - start,
            response: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
          }
        } catch (err: any) {
          result = { success: false, latencyMs: Date.now() - start, error: err.message }
        }
        break
      }

      default:
        return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
