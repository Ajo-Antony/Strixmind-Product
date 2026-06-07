// ─── Reflection Layer ─────────────────────────────────────────────────────────
// After agents complete, reflection checks the final output quality.
// If it fails, it triggers a single retry with corrective instructions.

import { callAI } from '@/lib/ai'

export interface ReflectionResult {
  passed: boolean
  score: number        // 0-100
  critiques: string[]
  improved?: string
  log: string[]
}

const REFLECTION_SYSTEM = `You are a senior quality reviewer for an AI sales assistant.
Evaluate the final reply generated for a WhatsApp conversation with a customer.
Be strict but constructive.

Score on these dimensions (each 0-20):
1. Relevance — does it address what the customer said?
2. Tone — warm, professional, not pushy?
3. Clarity — easy to read, concise?
4. Forward momentum — does it move toward a sale/appointment?
5. Accuracy — no invented facts?

Respond ONLY with valid JSON:
{
  "score": <0-100>,
  "passed": <true if score >= 70>,
  "critiques": ["..."],
  "improved": "improved version if score < 70, else null"
}`

export async function runReflectionLayer(
  reply: string,
  originalMessage: string,
  conversationId?: string
): Promise<ReflectionResult> {
  const log: string[] = []

  log.push(`Reflecting on reply (${reply.length} chars)…`)

  let result: ReflectionResult = {
    passed: true,
    score: 100,
    critiques: [],
    log,
  }

  try {
    const res = await callAI({
      systemPrompt: REFLECTION_SYSTEM,
      messages: [{
        role: 'user',
        content: `Customer message:\n${originalMessage}\n\nDraft reply:\n${reply}`,
      }],
      temperature: 0.1,
      maxTokens: 500,
      taskType: 'reflection',
      responseFormat: 'json',
      size: 'small',
      conversationId,
    })

    const parsed = JSON.parse(res.text)
    result.score = parsed.score ?? 100
    result.passed = parsed.passed ?? result.score >= 70
    result.critiques = parsed.critiques ?? []

    if (!result.passed && parsed.improved) {
      result.improved = parsed.improved
      log.push(`Score ${result.score}/100 — reflection triggered improvement`)
    } else {
      log.push(`Score ${result.score}/100 — passed`)
    }
  } catch (err: any) {
    log.push(`Reflection error: ${err.message} — defaulting to pass`)
  }

  result.log = log
  return result
}
