// ─── AI Provider Router ───────────────────────────────────────────────────────
// Extends the existing provider system with a pluggable router pattern.

import OpenAI from 'openai'
import type { AIRequestOptions, AIResponse, ProviderName, ModelSize } from './types'
import { callCohere, resolveCohereModel } from './cohere'

// Module-level singleton — avoids re-instantiating on every request
const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ─── Model resolution ─────────────────────────────────────────────────────────
const MODEL_MAP: Record<ProviderName, Record<ModelSize, string>> = {
  openai: {
    small: process.env.AI_MODEL_SMALL ?? 'gpt-4o-mini',
    large: process.env.AI_MODEL_LARGE ?? 'gpt-4o',
  },
  anthropic: {
    small: 'claude-haiku-4-5-20251001',
    large: 'claude-sonnet-4-6',
  },
  gemini: {
    small: 'gemini-2.0-flash',
    large: 'gemini-2.5-pro',
  },
  cohere: {
    small: 'command-r',
    large: 'command-r-plus',
  },
}

export function resolveModel(provider: ProviderName, size: ModelSize): string {
  if (provider === 'cohere') return resolveCohereModel(size)
  return MODEL_MAP[provider]?.[size] ?? MODEL_MAP.openai[size]
}

// ─── Provider call dispatch ────────────────────────────────────────────────────
export async function dispatchToProvider(
  opts: AIRequestOptions & { model: string }
): Promise<AIResponse> {
  const provider = (opts.provider ?? process.env.AI_PROVIDER ?? 'openai') as ProviderName

  switch (provider) {
    case 'cohere':
      return callCohere(opts)

    case 'anthropic':
      return callAnthropicProvider(opts)

    case 'gemini':
      return callGeminiProvider(opts)

    case 'openai':
    default:
      return callOpenAIProvider(opts)
  }
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────
async function callOpenAIProvider(opts: AIRequestOptions & { model: string }): Promise<AIResponse> {
  const completion = await openaiClient.chat.completions.create({
    model: opts.model,
    temperature: opts.temperature ?? 0.5,
    max_tokens: opts.maxTokens ?? 1000,
    response_format:
      opts.responseFormat === 'json' ? { type: 'json_object' } : undefined,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      ...opts.messages,
    ],
  })

  return {
    text: completion.choices[0].message.content ?? '',
    provider: 'openai',
    model: opts.model,
    promptTokens: completion.usage?.prompt_tokens ?? 0,
    completionTokens: completion.usage?.completion_tokens ?? 0,
    latencyMs: 0,
  }
}

// ─── Anthropic ────────────────────────────────────────────────────────────────
async function callAnthropicProvider(opts: AIRequestOptions & { model: string }): Promise<AIResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 1000,
      system: opts.systemPrompt,
      messages: opts.messages,
    }),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message ?? 'Anthropic error')

  return {
    text: data.content[0].text,
    provider: 'anthropic',
    model: opts.model,
    promptTokens: data.usage?.input_tokens ?? 0,
    completionTokens: data.usage?.output_tokens ?? 0,
    latencyMs: 0,
  }
}

// ─── Gemini ───────────────────────────────────────────────────────────────────
async function callGeminiProvider(opts: AIRequestOptions & { model: string }): Promise<AIResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${process.env.GEMINI_API_KEY}`

  const contents = opts.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.systemPrompt }] },
      contents,
      generationConfig: {
        temperature: opts.temperature ?? 0.5,
        maxOutputTokens: opts.maxTokens ?? 1000,
      },
    }),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message ?? 'Gemini error')

  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    provider: 'gemini',
    model: opts.model,
    promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
    completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    latencyMs: 0,
  }
}
