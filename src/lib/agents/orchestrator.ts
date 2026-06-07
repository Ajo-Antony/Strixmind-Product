// ─── Agent Orchestrator ───────────────────────────────────────────────────────
// The single entry point that:
//   1. Runs the Planner to decide which agents are needed
//   2. Enqueues tasks into the priority queue
//   3. Executes the queue (with retries)
//   4. Runs the Reflection layer on the final reply
//   5. Returns a structured OrchestratorOutput

import { TaskQueue } from './queue'
import { runPlannerAgent } from './planner'
import { runReflectionLayer } from './reflection'
import {
  researchAgent,
  crmAgent,
  outreachAgent,
  memoryAgent,
  analyticsAgent,
  validationAgent,
} from './specialized'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import type { OrchestratorInput, OrchestratorOutput } from './types'

export async function runOrchestrator(ctx: OrchestratorInput): Promise<OrchestratorOutput> {
  const start = Date.now()
  const reflectionLog: string[] = []

  // ── 1. Fetch full message history for context ────────────────────────────
  const db = createSupabaseServiceClient()
  const { data: messages } = await db
    .from('messages')
    .select('content, direction, sender_name, created_at')
    .eq('conversation_id', ctx.conversationId)
    .order('created_at', { ascending: false })
    .limit(20)

  const history = (messages ?? [])
    .reverse()
    .map((m: any) => ({ role: m.direction === 'inbound' ? 'user' : 'assistant', content: m.content }) as const)

  const fullCtx: OrchestratorInput = { ...ctx, history }

  // ── 2. Planner decides which agents to run ───────────────────────────────
  reflectionLog.push('Planner: analysing conversation…')
  const plan = await runPlannerAgent(fullCtx)
  reflectionLog.push(`Planner: ${plan.length} steps — ${plan.map(s => s.agent).join(' → ')}`)

  // ── 3. Build & run task queue ────────────────────────────────────────────
  const queue = new TaskQueue()

  queue.register('research',   researchAgent)
  queue.register('crm',        crmAgent)
  queue.register('outreach',   outreachAgent)
  queue.register('memory',     memoryAgent)
  queue.register('analytics',  analyticsAgent)
  queue.register('validation', validationAgent)

  // Shared context injected into every task input
  const sharedInput = {
    conversationId: ctx.conversationId,
    history: messages?.reverse() ?? [],
    contactName: ctx.contactName,
    leadContext: ctx.leadContext,
    model: ctx.model,
    provider: ctx.provider,
  }

  let priority = 1
  for (const step of plan) {
    queue.enqueue({
      agent: step.agent,
      input: { ...sharedInput, ...step.input },
      priority: priority++,
      maxRetries: 2,
    })
  }

  const completedTasks = await queue.runAll()
  reflectionLog.push(`Queue: ${completedTasks.length} tasks completed`)

  // ── 4. Extract the outreach result (the draft reply) ────────────────────
  const outreachTask = completedTasks.find(t => t.agent === 'outreach' && t.status === 'done')
  const suggestions: { text: string; label: string }[] = outreachTask?.result?.suggestions ?? []
  let reply = suggestions[0]?.text ?? 'Thank you for reaching out! We\'ll get back to you shortly. 😊'

  // ── 5. Check validation agent override ──────────────────────────────────
  const validationTask = completedTasks.find(t => t.agent === 'validation' && t.status === 'done')
  if (validationTask?.result?.passed === false && validationTask.result.improved) {
    reply = validationTask.result.improved
    reflectionLog.push('Validation: draft improved by validation agent')
  }

  // ── 6. Reflection layer ──────────────────────────────────────────────────
  reflectionLog.push('Reflection: evaluating final reply…')
  const reflection = await runReflectionLayer(reply, ctx.userMessage, ctx.conversationId)
  reflectionLog.push(...reflection.log)

  if (!reflection.passed && reflection.improved) {
    reply = reflection.improved
    reflectionLog.push('Reflection: reply improved after critique')
  }

  // ── 7. Return structured output ──────────────────────────────────────────
  const memoryTask = completedTasks.find(t => t.agent === 'memory' && t.status === 'done')
  const totalTokens = completedTasks.reduce((sum, t) => sum + (t.result?.tokensUsed ?? 0), 0)

  return {
    reply,
    summary: memoryTask?.result?.currentSummary,
    tasksCreated: completedTasks,
    reflectionLog,
    totalTokens,
    latencyMs: Date.now() - start,
  }
}
