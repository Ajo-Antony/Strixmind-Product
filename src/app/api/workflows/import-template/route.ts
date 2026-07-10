import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'

// ─── n8n → StrixMind node mapper ─────────────────────────────────────────────

function mapN8nNodeToStep(node: any): { type: string; config: Record<string, any> } | null {
  const t: string = node.type ?? ''
  const p: any = node.parameters ?? {}
  const name: string = (node.name ?? '').toLowerCase()

  // Triggers & sticky notes → skip
  if (
    t === 'n8n-nodes-base.webhook' ||
    t === 'n8n-nodes-base.scheduleTrigger' ||
    t === 'n8n-nodes-base.executeWorkflowTrigger' ||
    t === 'n8n-nodes-base.stickyNote'
  ) return null

  // ── Email → WhatsApp message ────────────────────────────────────────────────
  if (t === 'n8n-nodes-base.emailSend') {
    const subject: string = p.subject ?? ''
    const sl = subject.toLowerCase()
    if (sl.includes('welcome')) {
      return {
        type: 'send_whatsapp',
        config: { message: `Hi {{lead.name}}! 🎉 Welcome aboard! We're thrilled to have you. Reply anytime with questions.` },
      }
    }
    if (sl.includes('check') || sl.includes('first day') || sl.includes('how')) {
      return {
        type: 'send_whatsapp',
        config: { message: `Hi {{lead.name}}! 🌟 Just checking in — how's everything going so far? We're here to help!` },
      }
    }
    if (sl.includes('document') || sl.includes('onboard')) {
      return {
        type: 'send_whatsapp',
        config: { message: `Hi {{lead.name}}! 📋 Your onboarding resources are ready. Check your email for documents and next steps.` },
      }
    }
    if (sl.includes('week') || sl.includes('success') || sl.includes('guide')) {
      return {
        type: 'send_whatsapp',
        config: { message: `Hi {{lead.name}}! 🎯 Your Week 1 Success Guide is here — let's keep the momentum going!` },
      }
    }
    return {
      type: 'send_whatsapp',
      config: { message: subject ? `Hi {{lead.name}}! ${subject}` : `Hi {{lead.name}}! Quick update from our team. 👋` },
    }
  }

  // ── Team notifications (Telegram / Slack) ───────────────────────────────────
  if (t === 'n8n-nodes-base.telegram' || t === 'n8n-nodes-base.slack') {
    if (name.includes('complete') || name.includes('completion')) {
      return { type: 'notify', config: { message: `✅ {{lead.name}} completed onboarding! Score: {{lead.ai_score}}` } }
    }
    return { type: 'notify', config: { message: `🔔 New activity: {{lead.name}} (Stage: {{lead.stage}}, Score: {{lead.ai_score}})` } }
  }

  // ── Wait / delay ────────────────────────────────────────────────────────────
  if (t === 'n8n-nodes-base.wait') {
    const unit: string = p.unit ?? 'hours'
    const amount: number = Number(p.amount ?? 1)
    return { type: 'wait', config: { duration: amount, unit: unit === 'days' ? 'days' : 'hours' } }
  }

  // ── CRM (HubSpot) ───────────────────────────────────────────────────────────
  if (t === 'n8n-nodes-base.hubspot') {
    const op: string = p.operation ?? ''
    const res: string = p.resource ?? ''
    if (res === 'contact' && op === 'create') {
      return { type: 'update_lead', config: { stage: 'qualified' } }
    }
    if (name.includes('week') || name.includes('complete') || name.includes('mark')) {
      return { type: 'update_lead', config: { stage: 'converted' } }
    }
    if (name.includes('status') || op === 'update') {
      return { type: 'update_lead', config: { stage: 'contacted' } }
    }
    if (res === 'engagement' || op === 'search') {
      return { type: 'create_task', config: { title: 'Review CRM notes for {{lead.name}}', priority: 'medium', due_hours: 2 } }
    }
    return null
  }

  // ── AI / LLM chains & agents ────────────────────────────────────────────────
  if (
    t.includes('@n8n/n8n-nodes-langchain') ||
    t.includes('agent') ||
    t.includes('chain') ||
    t.includes('summariz')
  ) {
    if (name.includes('router') || name.includes('routing')) {
      return { type: 'ai_reply', config: { agent: 'Router Agent' } }
    }
    if (name.includes('summar')) {
      return { type: 'ai_outreach', config: { agent: 'Summary Agent', goal: 'Summarize conversation and route to the right department' } }
    }
    if (name.includes('research') || name.includes('attendee')) {
      return { type: 'ai_outreach', config: { agent: 'Research Agent', goal: 'Research attendee and prepare meeting briefing' } }
    }
    if (name.includes('linkedin')) {
      return { type: 'ai_outreach', config: { agent: 'LinkedIn Agent', goal: 'Summarize LinkedIn profile for talking points' } }
    }
    if (name.includes('correspondance') || name.includes('recap')) {
      return { type: 'ai_outreach', config: { agent: 'Correspondence Agent', goal: 'Summarize recent email thread for meeting prep' } }
    }
    const agentName = node.name ?? 'AI Agent'
    return { type: 'ai_outreach', config: { agent: agentName, goal: 'Process customer message and respond intelligently' } }
  }

  // ── WhatsApp direct ─────────────────────────────────────────────────────────
  if (t === 'n8n-nodes-base.whatsApp') {
    const body = p.textBody ?? ''
    return {
      type: 'send_whatsapp',
      config: { message: body || `Hi {{lead.name}}! Update from our team — reply anytime if you need help. 👋` },
    }
  }

  // ── Google Calendar ─────────────────────────────────────────────────────────
  if (t === 'n8n-nodes-base.googleCalendar') {
    return { type: 'update_appointment', config: { reminder_sent: true } }
  }

  // ── Validation / IF nodes ───────────────────────────────────────────────────
  if (t === 'n8n-nodes-base.if') {
    if (name.includes('valid') || name.includes('email') || name.includes('field')) {
      return { type: 'condition', config: { field: 'lead.stage', operator: 'eq', value: 'new' } }
    }
    return { type: 'condition', config: { field: 'lead.ai_score', operator: 'gte', value: '50' } }
  }

  // ── Gmail ───────────────────────────────────────────────────────────────────
  if (t === 'n8n-nodes-base.gmail' || t === 'n8n-nodes-base.gmailTool') {
    return { type: 'create_task', config: { title: 'Follow up email with {{lead.name}}', priority: 'medium', due_hours: 4 } }
  }

  return null
}

function mapN8nTrigger(nodes: any[]): { trigger_type: string; trigger_config: Record<string, any> } {
  const scheduler = nodes.find(n => n.type === 'n8n-nodes-base.scheduleTrigger')
  if (scheduler) return { trigger_type: 'scheduled', trigger_config: { cron: 'daily_9am' } }

  const webhook = nodes.find(n =>
    n.type === 'n8n-nodes-base.webhook' ||
    n.name?.toLowerCase().includes('webhook') ||
    n.name?.toLowerCase().includes('trigger')
  )

  if (!webhook) return { trigger_type: 'manual', trigger_config: {} }

  const path: string = (webhook.parameters?.path ?? '').toLowerCase()
  if (path.includes('onboard') || path.includes('customer')) {
    return { trigger_type: 'inbound_message', trigger_config: { keyword: '' } }
  }
  if (path.includes('lead')) {
    return { trigger_type: 'inbound_message', trigger_config: {} }
  }
  return { trigger_type: 'inbound_message', trigger_config: {} }
}

// ─── POST /api/workflows/import-template ──────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { n8n_json, name, description } = body

    if (!n8n_json) {
      return NextResponse.json({ error: 'n8n_json is required' }, { status: 400 })
    }

    let workflow: any
    try {
      workflow = typeof n8n_json === 'string' ? JSON.parse(n8n_json) : n8n_json
    } catch {
      return NextResponse.json({ error: 'Invalid JSON — paste a valid n8n workflow export' }, { status: 400 })
    }

    const nodes: any[] = workflow.nodes ?? []
    if (!nodes.length) {
      return NextResponse.json({ error: 'Workflow has no nodes' }, { status: 400 })
    }

    // Find entry trigger
    const triggerNode = nodes.find(n =>
      n.type === 'n8n-nodes-base.webhook' ||
      n.type === 'n8n-nodes-base.scheduleTrigger' ||
      n.type === 'n8n-nodes-base.executeWorkflowTrigger'
    ) ?? nodes[0]

    // BFS to order nodes by connection topology
    const connections: any = workflow.connections ?? {}
    const visited = new Set<string>()
    const orderedNodes: any[] = []
    const queue: string[] = [triggerNode?.name ?? '']

    while (queue.length) {
      const nodeName = queue.shift()!
      if (visited.has(nodeName)) continue
      visited.add(nodeName)
      const node = nodes.find((n: any) => n.name === nodeName)
      if (node) orderedNodes.push(node)
      const downstreams: any[] = (connections[nodeName]?.main ?? []).flat()
      for (const c of downstreams) {
        if (c?.node && !visited.has(c.node)) queue.push(c.node)
      }
    }

    // Catch any disconnected nodes not reachable from trigger
    for (const n of nodes) {
      if (!visited.has(n.name)) orderedNodes.push(n)
    }

    const steps = orderedNodes
      .map(mapN8nNodeToStep)
      .filter((s): s is { type: string; config: Record<string, any> } => s !== null)

    if (steps.length === 0) {
      return NextResponse.json({
        error: 'No mappable steps found. This template may use node types not supported in StrixMind yet.',
      }, { status: 400 })
    }

    const { trigger_type, trigger_config } = mapN8nTrigger(nodes)

    const workflowName = name?.trim() || workflow.name || 'Imported Workflow'
    const workflowDesc = description?.trim() || `Imported from n8n · ${nodes.length} original nodes → ${steps.length} steps`

    const db = createSupabaseServiceClient()
    const { data, error } = await db
      .from('workflows')
      .insert({
        name: workflowName,
        description: workflowDesc,
        trigger_type,
        trigger_config,
        steps,
        active: false,
        run_count: 0,
        success_count: 0,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(
      { data, steps_imported: steps.length, original_nodes: nodes.length },
      { status: 201 }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
