// ─── Cohere Provider ─────────────────────────────────────────────────────────
import type { AIRequestOptions, AIResponse } from './types'

const COHERE_MODELS = {
  small: 'command-r-08-2024',
  large: 'command-a-03-2025',
} as const

export function resolveCohereModel(size: 'small' | 'large', model?: string): string {
  if (model) return model
  return COHERE_MODELS[size]
}

/**
 * Call Cohere Chat API (non-streaming)
 */
export async function callCohere(
  opts: AIRequestOptions & { model: string },
  apiKey?: string
): Promise<AIResponse> {
  const key = apiKey ?? process.env.COHERE_API_KEY
  if (!key) throw new Error('COHERE_API_KEY is not configured')

  // Build Cohere chat history (exclude the last user message — it goes in message field)
  const history = opts.messages.slice(0, -1).map((m) => ({
    role: m.role === 'user' ? 'USER' : 'CHATBOT',
    message: m.content,
  }))

  const lastMessage = opts.messages[opts.messages.length - 1]
  if (!lastMessage) throw new Error('No messages provided')

  const body = {
    model: opts.model,
    message: lastMessage.content,
    chat_history: history.length > 0 ? history : undefined,
    preamble: opts.systemPrompt,
    temperature: opts.temperature ?? 0.5,
    max_tokens: opts.maxTokens ?? 1000,
    ...(opts.responseFormat === 'json'
      ? { response_format: { type: 'json_object' } }
      : {}),
  }

  const response = await fetch('https://api.cohere.com/v1/chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'X-Client-Name': 'strixmind',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Cohere API error' }))
    throw new Error(err.message ?? `Cohere API error: ${response.status}`)
  }

  const data = await response.json()

  return {
    text: data.text ?? '',
    provider: 'cohere',
    model: opts.model,
    promptTokens: data.meta?.tokens?.input_tokens ?? 0,
    completionTokens: data.meta?.tokens?.output_tokens ?? 0,
    latencyMs: 0,
  }
}

/**
 * Call Cohere Chat API (streaming) — yields text chunks
 */
export async function* streamCohere(
  opts: AIRequestOptions & { model: string },
  apiKey?: string
): AsyncGenerator<string> {
  const key = apiKey ?? process.env.COHERE_API_KEY
  if (!key) throw new Error('COHERE_API_KEY is not configured')

  const history = opts.messages.slice(0, -1).map((m) => ({
    role: m.role === 'user' ? 'USER' : 'CHATBOT',
    message: m.content,
  }))

  const lastMessage = opts.messages[opts.messages.length - 1]
  if (!lastMessage) throw new Error('No messages provided')

  const response = await fetch('https://api.cohere.com/v1/chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'X-Client-Name': 'strixmind',
    },
    body: JSON.stringify({
      model: opts.model,
      message: lastMessage.content,
      chat_history: history.length > 0 ? history : undefined,
      preamble: opts.systemPrompt,
      temperature: opts.temperature ?? 0.5,
      max_tokens: opts.maxTokens ?? 1000,
      stream: true,
    }),
  })

  if (!response.ok || !response.body) {
    const err = await response.json().catch(() => ({ message: 'Cohere stream error' }))
    throw new Error(err.message ?? `Cohere API error: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter(Boolean)

    for (const line of lines) {
      try {
        const event = JSON.parse(line)
        if (event.event_type === 'text-generation' && event.text) {
          yield event.text
        }
      } catch {
        // skip malformed lines
      }
    }
  }
}

/**
 * Test Cohere connection with a minimal prompt
 */
export async function testCohereConnection(
  apiKey: string,
  model = 'command-r-08-2024'
): Promise<{ success: boolean; latencyMs: number; error?: string; response?: string }> {
  const start = Date.now()
  try {
    const result = await callCohere(
      {
        model,
        systemPrompt: 'You are a helpful assistant.',
        messages: [{ role: 'user', content: 'Reply with exactly: "Connection successful"' }],
        maxTokens: 20,
        temperature: 0,
        taskType: 'connection_test',
      },
      apiKey
    )
    return {
      success: true,
      latencyMs: Date.now() - start,
      response: result.text,
    }
  } catch (err: any) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: err?.message ?? 'Unknown error',
    }
  }
}
