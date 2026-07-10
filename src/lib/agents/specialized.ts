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
// Generates context-aware reply suggestions.
// When the conversation is in qualification mode (outreach: true metadata),
// it follows a structured qualification flow and detects interest signals.
export async function outreachAgent(task: AgentTask): Promise<any> {
  const { conversationId, history, contactName, leadContext, tone, model, provider } = task.input

  const historyText = (history ?? [])
    .slice(-10)
    .map((m: any) => `${m.direction === 'inbound' ? 'Customer' : 'Agent'}: ${m.content}`)
    .join('\n')

  // Detect if this is a qualification outreach conversation
  const isQualification = leadContext?.includes('qualification') ||
    (history ?? []).some((m: any) => m.metadata?.qualification)

  const systemPrompt = isQualification
    ? `You are a friendly AI sales assistant for StrixMind, an AI automation company that helps businesses automate client acquisition, WhatsApp follow-ups, CRM workflows, and lead management.

Your goal in this conversation is to:
1. Understand what the prospect's business does and their main pain points
2. Gauge their interest in AI automation tools
3. Collect key info: their business type, team size, current tools they use
4. Pitch StrixMind's value clearly and naturally — not pushy
5. Ask if they'd like a free demo or consultation call
6. If they say YES or show interest → confirm and say the team will reach out
7. If they say NO or not interested → thank them warmly and close gracefully

Tone: friendly, helpful, conversational. Use emojis naturally. Keep messages short (2-4 lines max for WhatsApp).

IMPORTANT — after generating suggestions also output an "intent" field:
- "interested" if the customer is clearly interested or agreed to a demo
- "not_interested" if they clearly declined or said not now
- "collecting_info" if still in discovery
- "neutral" if unclear

Respond ONLY with JSON:
{
  "suggestions": [{"text": "...", "label": "short label"}],
  "intent": "interested|not_interested|collecting_info|neutral",
  "collected": { "business_type": "...", "pain_point": "...", "team_size": "..." }
}`
    : `You are an expert sales assistant for StrixMind AI. Generate exactly 3 WhatsApp reply suggestions.
Tone: ${tone ?? 'warm and professional'}. Use emojis naturally. Move toward a sale or appointment.
Respond ONLY with JSON: {"suggestions": [{"text": "...", "label": "short label"}], "intent": "neutral", "collected": {}}`

  const res = await callAI({
    systemPrompt,
    messages: [{
      role: 'user',
      content: `Customer: ${contactName ?? 'Customer'}\nContext: ${leadContext ?? 'New lead'}\n\nConversation:\n${historyText}\n\nGenerate 3 reply suggestions.`,
    }],
    temperature: 0.7,
    maxTokens: 800,
    taskType: 'reply_suggestions',
    responseFormat: 'json',
    size: 'large',
    conversationId,
    model,
    provider: provider as any,
  })

  const parsed = JSON.parse(res.text)

  // If we detected a clear intent, update the lead stage in the background
  if (conversationId && parsed.intent && parsed.intent !== 'neutral') {
    updateLeadFromQualification(conversationId, parsed.intent, parsed.collected ?? {}).catch(() => {})
  }

  return { suggestions: parsed.suggestions, intent: parsed.intent, collected: parsed.collected, tokensUsed: res.completionTokens }
}

// Updates lead stage/notes based on qualification outcome
async function updateLeadFromQualification(
  conversationId: string,
  intent: string,
  collected: Record<string, string>
) {
  const supabase = createSupabaseServiceClient()

  const { data: conv } = await supabase
    .from('conversations')
    .select('lead_id')
    .eq('id', conversationId)
    .single()

  if (!conv?.lead_id) return

  const stageMap: Record<string, string> = {
    interested:      'qualified',
    not_interested:  'closed',
    collecting_info: 'contacted',
    neutral:         'contacted',
  }

  const patch: Record<string, any> = {
    stage: stageMap[intent] ?? 'contacted',
    updated_at: new Date().toISOString(),
  }

  // Store collected info in notes
  if (Object.keys(collected).length > 0) {
    const collectedText = Object.entries(collected)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
    if (collectedText) {
      const { data: lead } = await supabase.from('leads').select('notes').eq('id', conv.lead_id).single()
      patch.notes = lead?.notes ? `${lead.notes}\n[AI Qualification] ${collectedText}` : `[AI Qualification] ${collectedText}`
    }
  }

  if (intent === 'interested')     patch.urgency  = 'high'
  if (intent === 'not_interested') patch.sentiment = 'negative'
  if (intent === 'interested')     patch.sentiment = 'positive'

  await supabase.from('leads').update(patch).eq('id', conv.lead_id)
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
