// ─── Specialized Agents ───────────────────────────────────────────────────────

import { callAI } from '@/lib/ai'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import type { AgentTask } from './types'

const db = () => createSupabaseServiceClient()

// ── Research Agent ────────────────────────────────────────────────────────────
// Looks up product info, boutique catalogue, or web context
export async function researchAgent(task: AgentTask): Promise<any> {
  const { query, conversationId } = task.input

  // First try internal catalogue (Supabase)
  const { data: products } = await db()
    .from('products')
    .select('name, description, price, category')
    .textSearch('name', query ?? '', { type: 'websearch' })
    .limit(5)

  if (products && products.length > 0) return { source: 'catalogue', results: products }

  // Fallback: ask AI to summarise what it knows
  const res = await callAI({
    systemPrompt: 'You are a product research assistant for a bridal boutique. Answer briefly and accurately.',
    messages: [{ role: 'user', content: query }],
    temperature: 0.3,
    maxTokens: 300,
    taskType: 'research',
    size: 'small',
    conversationId,
  })

  return { source: 'ai', summary: res.text }
}

// ── CRM Agent ────────────────────────────────────────────────────────────────
// Reads/writes lead and contact data
export async function crmAgent(task: AgentTask): Promise<any> {
  const { action, conversationId, data } = task.input

  if (action === 'get_lead') {
    const { data: conv } = await db()
      .from('conversations')
      .select('*, contact:contacts(*), lead:leads(*)')
      .eq('id', conversationId)
      .single()
    return conv
  }

  if (action === 'update_lead' && data) {
    const { data: conv } = await db()
      .from('conversations')
      .select('lead_id')
      .eq('id', conversationId)
      .single()

    if (conv?.lead_id) {
      await db().from('leads').update(data).eq('id', conv.lead_id)
    }
    return { updated: true }
  }

  if (action === 'create_task' && data) {
    const { data: task } = await db().from('tasks').insert(data).select().single()
    return { task }
  }

  return { error: 'Unknown CRM action' }
}

// ── Outreach Agent ────────────────────────────────────────────────────────────
// Generates context-aware reply suggestions
export async function outreachAgent(task: AgentTask): Promise<any> {
  const { conversationId, history, contactName, leadContext, tone, model, provider } = task.input

  const historyText = (history ?? [])
    .slice(-10)
    .map((m: any) => `${m.direction === 'inbound' ? 'Customer' : 'Agent'}: ${m.content}`)
    .join('\n')

  const res = await callAI({
    systemPrompt: `You are an expert sales assistant for a premium bridal boutique. Generate exactly 3 WhatsApp reply suggestions.
Tone: ${tone ?? 'warm and professional'}. Use emojis naturally. Move toward a sale or appointment.
Respond ONLY with JSON: {"suggestions": [{"text": "...", "label": "short label"}]}`,
    messages: [{
      role: 'user',
      content: `Customer: ${contactName ?? 'Customer'}\nContext: ${leadContext ?? 'New lead'}\n\nConversation:\n${historyText}\n\nGenerate 3 reply suggestions.`,
    }],
    temperature: 0.7,
    maxTokens: 600,
    taskType: 'reply_suggestions',
    responseFormat: 'json',
    size: 'large',
    conversationId,
    model,
    provider: provider as any,
  })

  const parsed = JSON.parse(res.text)
  return { suggestions: parsed.suggestions, tokensUsed: res.completionTokens }
}

// ── Memory Agent ──────────────────────────────────────────────────────────────
// Retrieves past summaries or semantically similar past conversations
// (pgvector integration ready — falls back to text match without embeddings)
export async function memoryAgent(task: AgentTask): Promise<any> {
  const { conversationId, query } = task.input

  // Fetch stored AI summary for this conversation
  const { data: conv } = await db()
    .from('conversations')
    .select('ai_summary, contact_id')
    .eq('id', conversationId)
    .single()

  // Look for similar past conversations (simple text approach;
  // swap for pgvector similarity search once embeddings are stored)
  const { data: similar } = await db()
    .from('conversations')
    .select('ai_summary, last_message_preview, last_message_at')
    .eq('contact_id', conv?.contact_id)
    .neq('id', conversationId)
    .order('last_message_at', { ascending: false })
    .limit(3)

  return {
    currentSummary: conv?.ai_summary ?? null,
    pastConversations: similar ?? [],
  }
}

// ── Analytics Agent ───────────────────────────────────────────────────────────
// Fetches lead scores, conversion metrics, and agent performance
export async function analyticsAgent(task: AgentTask): Promise<any> {
  const { conversationId } = task.input

  const { data: conv } = await db()
    .from('conversations')
    .select('ai_score, sentiment, priority, lead:leads(intent, budget, urgency, ai_score)')
    .eq('id', conversationId)
    .single()

  const { count: openCount } = await db()
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open')

  return {
    leadScore: (conv?.lead as any)?.ai_score ?? conv?.ai_score ?? 0,
    sentiment: conv?.sentiment,
    priority: conv?.priority,
    totalOpen: openCount,
    intent: (conv?.lead as any)?.intent,
    budget: (conv?.lead as any)?.budget,
  }
}

// ── Validation Agent ──────────────────────────────────────────────────────────
// Checks a draft reply for quality, tone, and compliance before sending
export async function validationAgent(task: AgentTask): Promise<any> {
  const { draft, conversationId } = task.input

  if (!draft) return { passed: true, reason: 'No draft to validate' }

  const res = await callAI({
    systemPrompt: `You are a quality validation agent for a premium boutique. Check if this WhatsApp reply is:
1. Warm and professional
2. Not too salesy or pushy
3. Free of spelling errors
4. Under 200 words
5. Moves the conversation forward

Respond ONLY with JSON: {"passed": true/false, "issues": ["..."], "improved": "improved version if failed"}`,
    messages: [{ role: 'user', content: `Draft reply to validate:\n${draft}` }],
    temperature: 0.1,
    maxTokens: 400,
    taskType: 'validation',
    responseFormat: 'json',
    size: 'small',
    conversationId,
  })

  try {
    return JSON.parse(res.text)
  } catch {
    return { passed: true, reason: 'Validation parse error — defaulting to pass' }
  }
}
