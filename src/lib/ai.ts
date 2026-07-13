// ─── AI Module ────────────────────────────────────────────────────────────────
// Updated with Cohere support. Re-exports from new providers system.

import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from './supabase/server'
import { dispatchToProvider, resolveModel } from './ai/providers/router'
import type { AIRequestOptions, AIResponse, ProviderName } from './ai/providers/types'

export type { AIRequestOptions, AIResponse }
export type { ProviderName as AIProvider }
export type { ModelSize } from './ai/providers/types'
export { PROVIDER_CONFIGS } from './ai/providers'
export { testCohereConnection, streamCohere } from './ai/providers/cohere'

// ─── Main gateway (backward-compatible) ─────────────────────────────────────
export async function callAI(opts: AIRequestOptions): Promise<AIResponse> {
  const provider = (opts.provider ?? (process.env.AI_PROVIDER as ProviderName) ?? 'openai')
  const model = opts.model ?? resolveModel(provider, opts.size ?? 'small')
  const start = Date.now()

  let result: AIResponse

  try {
    result = await dispatchToProvider({ ...opts, provider, model })
    result.latencyMs = Date.now() - start

    await logAIRequest({
      provider, model,
      taskType: opts.taskType,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      latencyMs: result.latencyMs,
      success: true,
      conversationId: opts.conversationId,
      leadId: opts.leadId,
    })

    return result
  } catch (err: any) {
    await logAIRequest({
      provider, model,
      taskType: opts.taskType,
      latencyMs: Date.now() - start,
      success: false,
      errorMessage: err?.message,
      conversationId: opts.conversationId,
      leadId: opts.leadId,
    })
    throw err
  }
}

// ─── Structured AI tasks ─────────────────────────────────────────────────────
export interface LeadAnalysis {
  intent: string
  budget: number | null
  urgency: 'low' | 'medium' | 'high'
  timeline: string | null
  sentiment: 'positive' | 'neutral' | 'negative'
  ai_score: number
  confidence: number
  summary: string
  suggested_reply: string
  suggested_tags: string[]
  create_task: boolean
  task_title: string | null
  is_genuine?: boolean
  genuineness_score?: number
  genuineness_reasoning?: string
  recommended_next_followup_hours?: number
  followup_message_draft?: string
}

export async function analyzeLeadFromConversation(
  messages: { role: 'user' | 'assistant'; content: string }[],
  conversationId?: string,
  leadId?: string
): Promise<LeadAnalysis> {
  const SYSTEM = `You are a lead qualification AI for a premium bridal and fashion boutique. Analyze this WhatsApp conversation and extract structured lead information.
Respond ONLY with valid JSON, no markdown, no explanation. Required fields:
{
  "intent": "bridal_purchase|saree_purchase|casual_browse|gift|event_wear|inquiry",
  "budget": <number in INR or null>,
  "urgency": "low|medium|high",
  "timeline": "<string like '1_month' or null>",
  "sentiment": "positive|neutral|negative",
  "ai_score": <0-100 integer>,
  "confidence": <0.0-1.0 float>,
  "summary": "<1-2 sentence business summary>",
  "suggested_reply": "<warm professional WhatsApp reply>",
  "suggested_tags": ["tag1", "tag2"],
  "create_task": <true|false>,
  "task_title": "<string or null>",
  "is_genuine": <true|false (whether this is a real customer with genuine intent, not spam/gibberish/wrong number)>,
  "genuineness_score": <0-100 integer representing lead authenticity/realness>,
  "genuineness_reasoning": "<1 sentence explaining why they are or aren't genuine>",
  "recommended_next_followup_hours": <number representing hours to wait before next automated touchpoint, default is 24>,
  "followup_message_draft": "<a perfectly written custom follow-up message to send later, based on their response/budget/gaps>"
}`

  const result = await callAI({
    systemPrompt: SYSTEM,
    messages,
    temperature: 0.2,
    maxTokens: 600,                // increased slightly to fit added fields comfortably
    taskType: 'lead_qualification',
    responseFormat: 'json',
    provider: 'gemini',
    model: 'gemini-2.0-flash',    // fastest for JSON extraction
    size: 'small',
    conversationId,
    leadId,
  })

  return JSON.parse(result.text) as LeadAnalysis
}

export async function generateReplySuggestions(
  conversationHistory: string,
  customerName: string,
  leadContext: string,
  conversationId?: string
): Promise<{ text: string; label: string }[]> {
  const SYSTEM = `You are an expert sales assistant for a premium bridal and fashion boutique. Generate exactly 3 WhatsApp reply suggestions for the agent.
Rules: warm, professional, conversational, move toward sale or appointment, use emojis naturally.
Respond ONLY with JSON: {"suggestions": [{"text": "...", "label": "Short label"}]}`

  const result = await callAI({
    systemPrompt: SYSTEM,
    messages: [{
      role: 'user',
      content: `Customer: ${customerName}\nContext: ${leadContext}\n\nConversation:\n${conversationHistory}\n\nGenerate 3 reply suggestions.`,
    }],
    temperature: 0.7,
    maxTokens: 400,                // 3 short WhatsApp messages fit easily in 400 tokens
    taskType: 'reply_suggestions',
    responseFormat: 'json',
    size: 'large',
    conversationId,
  })

  const parsed = JSON.parse(result.text)
  return parsed.suggestions
}

export async function generateConversationSummary(
  messages: string,
  conversationId?: string
): Promise<string> {
  const result = await callAI({
    systemPrompt: 'You are a CRM summarization AI. Write a concise 2-3 sentence summary of this WhatsApp conversation covering: who the customer is, what they want, current status, and recommended next action. Plain text only.',
    messages: [{ role: 'user', content: messages }],
    temperature: 0.3,
    maxTokens: 150,                // 2-3 sentence summary
    taskType: 'summary',
    provider: 'gemini',
    model: 'gemini-2.0-flash',    // fast and sufficient for summarization
    size: 'small',
    conversationId,
  })

  return result.text
}

// ─── Log AI request ───────────────────────────────────────────────────────────
async function logAIRequest(data: {
  provider: string; model: string; taskType: string
  promptTokens?: number; completionTokens?: number; latencyMs: number
  success: boolean; errorMessage?: string
  conversationId?: string; leadId?: string
}) {
  try {
    const db = createSupabaseServiceClient()
    await db.from('ai_requests').insert({
      provider: data.provider,
      model: data.model,
      task_type: data.taskType,
      prompt_tokens: data.promptTokens ?? null,
      completion_tokens: data.completionTokens ?? null,
      total_tokens: (data.promptTokens ?? 0) + (data.completionTokens ?? 0),
      latency_ms: data.latencyMs,
      success: data.success,
      error_message: data.errorMessage ?? null,
      conversation_id: data.conversationId ?? null,
      lead_id: data.leadId ?? null,
    })
  } catch { /* non-blocking */ }
}
