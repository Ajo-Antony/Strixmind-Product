// ─── /api/orchestrate ─────────────────────────────────────────────────────────
// POST body: { conversation_id, model?, provider? }
// Returns: { reply, suggestions, reflectionLog, latencyMs }

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import { runOrchestrator } from '@/lib/agents/orchestrator'

export async function POST(req: NextRequest) {
  const db = createSupabaseServiceClient()

  try {
    const body = await req.json()
    const { conversation_id, model, provider } = body

    if (!conversation_id) {
      return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 })
    }

    // Fetch conversation + contact + lead context
    const { data: conv, error } = await db
      .from('conversations')
      .select('*, contact:contacts(name, phone), lead:leads(intent, budget, urgency, ai_score)')
      .eq('id', conversation_id)
      .single()

    if (error || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const contact = (conv as any).contact
    const lead = (conv as any).lead

    const result = await runOrchestrator({
      conversationId: conversation_id,
      userMessage: conv.last_message_preview ?? '',
      history: [],            // orchestrator fetches full history internally
      contactName: contact?.name,
      leadContext: lead
        ? `Intent: ${lead.intent}, Budget: ₹${lead.budget ?? 'unknown'}, Score: ${lead.ai_score}/100`
        : 'New lead',
      model,
      provider,
    })

    // Extract top 3 suggestions from outreach task
    const outreachTask = result.tasksCreated?.find(t => t.agent === 'outreach')
    const suggestions = outreachTask?.result?.suggestions ?? [{ text: result.reply, label: 'AI reply' }]

    return NextResponse.json({
      data: {
        reply: result.reply,
        suggestions,
        reflectionLog: result.reflectionLog,
        totalTokens: result.totalTokens,
        latencyMs: result.latencyMs,
      },
    })
  } catch (err: any) {
    console.error('[orchestrate] error:', err)
    return NextResponse.json({ error: err.message ?? 'Orchestration failed' }, { status: 500 })
  }
}
