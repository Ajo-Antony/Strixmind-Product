// ─── Planner Agent ────────────────────────────────────────────────────────────
// Reads conversation context and decides which specialized agents to invoke
// and in what order.

import { callAI } from '@/lib/ai'
import type { PlanStep, OrchestratorInput } from './types'

const PLANNER_SYSTEM = `You are the Planner Agent for StrixMind, an AI-powered WhatsApp CRM for boutiques.

Given a conversation context, decide which specialist agents are needed and in what order.
Available agents:
- research    : look up product info, web data, or context
- crm         : read/write leads, contacts, tasks in the database
- outreach    : draft WhatsApp or email messages
- memory      : retrieve past conversation summaries or semantic matches
- analytics   : fetch metrics, lead scores, conversion rates
- validation  : check a draft reply for quality, tone, and policy

Rules:
- Always include "outreach" to generate the final reply
- Only include agents that are genuinely needed
- Explain each agent choice in "reason"
- Return ONLY valid JSON, no markdown

Response format:
{
  "steps": [
    { "agent": "memory", "reason": "...", "input": { "query": "..." } },
    { "agent": "crm", "reason": "...", "input": { "action": "get_lead" } },
    { "agent": "outreach", "reason": "...", "input": { "tone": "warm" } },
    { "agent": "validation", "reason": "...", "input": {} }
  ]
}`

export async function runPlannerAgent(ctx: OrchestratorInput): Promise<PlanStep[]> {
  const userContent = `
Contact: ${ctx.contactName ?? 'Unknown'}
Lead context: ${ctx.leadContext ?? 'No lead data'}
Last message: ${ctx.userMessage}
History (last 5):
${ctx.history.slice(-5).map(m => `${m.role === 'user' ? 'Customer' : 'Agent'}: ${m.content}`).join('\n')}

Decide which agents are needed.`

  const res = await callAI({
    systemPrompt: PLANNER_SYSTEM,
    messages: [{ role: 'user', content: userContent }],
    temperature: 0.2,
    maxTokens: 600,
    taskType: 'planning',
    responseFormat: 'json',
    size: 'small',
    conversationId: ctx.conversationId,
    model: ctx.model,
    provider: ctx.provider as any,
  })

  try {
    const parsed = JSON.parse(res.text)
    return (parsed.steps ?? []) as PlanStep[]
  } catch {
    // Fallback: always at least do outreach + validation
    return [
      { agent: 'outreach', reason: 'Generate reply', input: { tone: 'warm' } },
      { agent: 'validation', reason: 'Check quality', input: {} },
    ]
  }
}
