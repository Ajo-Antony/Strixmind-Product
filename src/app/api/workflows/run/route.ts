// src/app/api/workflows/run/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const supabase = new Proxy({}, {
  get: (target, prop) => {
    return (createSupabaseServiceClient() as any)[prop]
  }
}) as any

// ── Types ────────────────────────────────────────────────────────────────────
export interface StepLog {
  step: number
  type: string
  label: string
  status: 'success' | 'skipped' | 'error'
  message: string
  durationMs: number
}

export interface LeadExecution {
  leadId: string
  name: string
  phone: string
  steps: StepLog[]
  whatsappSent: boolean
  taskCreated: boolean
}

export interface ExecutionRecord {
  runId: string
  workflowId: string
  workflowName: string
  triggeredAt: string
  durationMs: number
  triggered: number
  skipped: number
  errors: string[]
  leads: LeadExecution[]
}

// ── Send plain WhatsApp text ──────────────────────────────────────────────────
async function sendWhatsApp(phone: string, text: string): Promise<boolean> {
  const apiVersion = process.env.NEXT_PUBLIC_WHATSAPP_API_VERSION ?? 'v19.0'
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_API_TOKEN
  if (!phoneNumberId || !token) {
    console.error('[sendWhatsApp] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_API_TOKEN')
    return false
  }
  try {
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone.replace(/\D/g, ''),
          type: 'text',
          text: { body: text },
        }),
      }
    )
    return r.ok
  } catch {
    return false
  }
}

// ── Send WhatsApp Template ────────────────────────────────────────────────────
async function sendWhatsAppTemplate(
  phone: string,
  templateName: string,
  variables: string[] = [],
  languageCode = 'en_US'
): Promise<boolean> {
  const apiVersion = process.env.NEXT_PUBLIC_WHATSAPP_API_VERSION ?? 'v19.0'
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_API_TOKEN
  if (!phoneNumberId || !token) {
    console.error('[sendWhatsAppTemplate] Missing credentials')
    return false
  }
  try {
    const components: any[] = []
    if (variables.length > 0) {
      components.push({
        type: 'body',
        parameters: variables.map(v => ({ type: 'text', text: v })),
      })
    }
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone.replace(/\D/g, ''),
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components: components.length > 0 ? components : undefined,
          },
        }),
      }
    )
    return r.ok
  } catch {
    return false
  }
}

// ── Build personalised outreach message ──────────────────────────────────────
function buildMessage(triggerType: string, lead: any, steps: any[]): string {
  const name = lead.name ?? lead.contact?.name ?? 'there'
  const outreachStep = steps.find(s => s.type === 'ai_outreach' || s.type === 'ai_reply')
  const goal = outreachStep?.config?.goal
  const waStep = steps.find(s => s.type === 'send_whatsapp')
  if (waStep?.config?.message) {
    return resolveVariable(waStep.config.message, { name, contact: { name }, ai_score: 0 })
  }
  if (triggerType === 'inactivity')
    return goal
      ? `Hi ${name}! ${goal} Let us know if there's anything we can help you with. 😊`
      : `Hi ${name}! We noticed we haven't heard from you in a while. We'd love to catch up — is there anything we can help you with today? 😊`
  if (triggerType === 'lead_score')
    return goal
      ? `Hi ${name}! ${goal}`
      : `Hi ${name}! We've reviewed your profile and think you'd be a great fit. Would you like to schedule a quick consultation?`
  if (triggerType === 'keyword_trigger' || triggerType === 'inbound_message')
    return goal
      ? `Hi ${name}! ${goal}`
      : `Hi ${name}! Thanks for reaching out. We've received your message and will get back to you shortly. How can we help today?`
  if (triggerType === 'appointment')
    return `Hi ${name}! This is a friendly reminder about your upcoming appointment with us. Please reply to confirm or let us know if you need to reschedule. 📅`
  return goal
    ? `Hi ${name}! ${goal}`
    : `Hi ${name}! Just checking in from StrixMind. Let us know if there's anything we can help you with today!`
}

// ── Resolve {{variable}} in message templates ─────────────────────────────────
function resolveVariable(tpl: string, lead: any): string {
  const name    = lead.name ?? lead.contact?.name ?? ''
  const phone   = lead.contact?.phone ?? lead.phone ?? ''
  const score   = String(lead.ai_score ?? 0)
  const stage   = lead.stage ?? ''
  const urgency = lead.urgency ?? ''
  return tpl
    .replace(/\{\{lead\.name\}\}/g,     name)
    .replace(/\{\{contact\.name\}\}/g,  name)
    .replace(/\{\{lead\.phone\}\}/g,    phone)
    .replace(/\{\{contact\.phone\}\}/g, phone)
    .replace(/\{\{lead\.ai_score\}\}/g, score)
    .replace(/\{\{lead\.score\}\}/g,    score)
    .replace(/\{\{lead\.stage\}\}/g,    stage)
    .replace(/\{\{lead\.urgency\}\}/g,  urgency)
    .replace(/\{\{1\}\}/g,              name)
}

// ── Build a task-notification message ────────────────────────────────────────
function buildTaskNotification(taskTitle: string, lead: any): string {
  const name = lead.name ?? lead.contact?.name ?? 'there'
  return `Hi ${name}! 👋 We've noted your case and our team will follow up shortly.\n\nReference: ${taskTitle}\n\nFeel free to reply if you have any questions. We're here to help!`
}

// ── Step label map ─────────────────────────────────────────────────────────────
const STEP_LABELS: Record<string, string> = {
  send_template: 'Send Template',
  send_whatsapp: 'Send Message',
  send_options: 'Send Options',
  wait_for_reply: 'Wait for Reply',
  notify: 'Notify Team',
  create_task: 'Create Task',
  update_lead: 'Update Lead',
  update_appointment: 'Update Appointment',
  condition: 'Condition',
  wait: 'Wait',
  ai_outreach: 'AI Agent Outreach',
  ai_reply: 'AI Auto-Reply',
}

// ── Fetch recent conversation messages for AI context ────────────────────────
async function fetchConversationMessages(conversationId: string, limit = 10): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const { data } = await supabase
    .from('messages')
    .select('content, direction, sender_type')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!data) return []
  return data
    .reverse()
    .map((m: any) => ({
      role: (m.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content ?? '',
    }))
    .filter((m: any) => m.content.trim().length > 0)
}

// ── Generate AI reply using the lead's conversation history ──────────────────
async function generateAIReply(
  stepType: string,
  agentName: string,
  goal: string | undefined,
  lead: any,
  conversationMessages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const name = lead.name ?? lead.contact?.name ?? 'the client'
  const stage = lead.stage ?? 'new'
  const score = lead.ai_score ?? 0

  const systemPrompt = stepType === 'ai_outreach'
    ? `You are ${agentName || 'an AI sales assistant'} for a premium business. Your goal: ${goal || 'engage the lead and understand their needs'}.
Lead name: ${name}. Pipeline stage: ${stage}. AI score: ${score}/100.
Write a warm, concise WhatsApp message (2-4 sentences max). No markdown, no asterisks. Personalise using their name.
If you have conversation history, reference it naturally. End with a clear question or call to action.`
    : `You are ${agentName || 'an AI support assistant'}. You are replying to a WhatsApp message from ${name}.
Goal: ${goal || 'help the client and move them forward in the sales process'}.
Write a helpful, concise reply (2-4 sentences). No markdown. Sound human and warm.
Use the conversation history to give a relevant, contextual response.`

  const messages = conversationMessages.length > 0
    ? conversationMessages
    : [{ role: 'user' as const, content: `Hi, I am ${name}. I am interested in your services.` }]

  const response = await callAI({
    systemPrompt,
    messages,
    taskType: 'chat',
    size: 'small',
    leadId: lead.id,
  })

  return response.text?.trim() ?? `Hi ${name}! Thanks for reaching out. How can we help you today?`
}

// ── POST /api/workflows/run ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const runStart = Date.now()
  try {
    const { workflow_id, manual = true } = await req.json()
    if (!workflow_id) return NextResponse.json({ error: 'workflow_id required' }, { status: 400 })

    // 1. Fetch workflow
    const { data: wf, error: wfErr } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflow_id)
      .single()

    if (wfErr || !wf) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    if (!wf.active) return NextResponse.json({ error: 'Workflow is paused' }, { status: 400 })

    const steps: any[] = Array.isArray(wf.steps) ? wf.steps : JSON.parse(wf.steps ?? '[]')
    const triggerConfig = wf.trigger_config ?? {}

    // 2. Find matching leads
    let leadsQuery = supabase
      .from('leads')
      .select('*, contact:contacts(*), conversations(id, last_message_at, status)')
      .neq('stage', 'converted')
      .neq('stage', 'closed')

    if (wf.trigger_type === 'lead_score') {
      const threshold = Number(triggerConfig.threshold ?? 80)
      leadsQuery = leadsQuery.gte('ai_score', threshold)
    }
    if (wf.trigger_type === 'inactivity') {
      const hours = Number(triggerConfig.hours ?? 72)
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
      leadsQuery = leadsQuery.lt('updated_at', cutoff)
    }
    if (wf.trigger_type === 'stage_change' && triggerConfig.to_stage) {
      leadsQuery = leadsQuery.eq('stage', triggerConfig.to_stage)
    }

    const { data: leads, error: leadsErr } = await leadsQuery.limit(50)
    if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 })

    const allErrors: string[] = []
    const leadExecutions: LeadExecution[] = []
    let triggered = 0
    let skipped = 0

    // 3. Execute steps per lead
    for (const lead of leads ?? []) {
      const phone = lead.contact?.phone ?? lead.phone
      if (!phone) { skipped++; continue }

      const stepLogs: StepLog[] = []
      let actionTaken = ''
      let whatsappSent = false
      let taskCreated = false
      let taskTitleForNotify = ''

      const logStep = (
        idx: number,
        type: string,
        status: StepLog['status'],
        message: string,
        durationMs: number
      ) => {
        stepLogs.push({
          step: idx + 1,
          type,
          label: STEP_LABELS[type] ?? type,
          status,
          message,
          durationMs,
        })
      }

      for (let si = 0; si < steps.length; si++) {
        const step = steps[si]
        const t0 = Date.now()
        try {
          // ── send_template ─────────────────────────────────────────────────
          if (step.type === 'send_template') {
            const templateName = step.config?.template_name
            if (!templateName) {
              allErrors.push(`send_template: missing template_name for ${lead.name}`)
              logStep(si, step.type, 'error', 'Missing template_name config', Date.now() - t0)
              continue
            }
            const variable1 = step.config?.variable_1
              ? resolveVariable(step.config.variable_1, lead)
              : (lead.name ?? lead.contact?.name ?? '')
            const variables = variable1 ? [variable1] : []
            const ok = await sendWhatsAppTemplate(phone, templateName, variables)
            if (ok) {
              actionTaken = actionTaken || `Template "${templateName}" sent`
              whatsappSent = true
              logStep(si, step.type, 'success', `Template "${templateName}" sent to ${phone}`, Date.now() - t0)
              const conv = (lead.conversations ?? [])[0]
              if (conv?.id) {
                await supabase.from('messages').insert({
                  conversation_id: conv.id,
                  direction: 'outbound',
                  content: `[Template: ${templateName}]${variable1 ? ` Hi ${variable1}` : ''}`,
                  sender_type: 'ai',
                  status: 'sent',
                  metadata: { template: true, template_name: templateName, workflow_id: wf.id },
                  created_at: new Date().toISOString(),
                })
              }
            } else {
              allErrors.push(`Template "${templateName}" failed for ${lead.name} (${phone})`)
              logStep(si, step.type, 'error', `WhatsApp API rejected template "${templateName}"`, Date.now() - t0)
            }
          }

          // ── send_whatsapp / ai_outreach / ai_reply ─────────────────────────
          if (step.type === 'ai_outreach' || step.type === 'ai_reply' || step.type === 'send_whatsapp') {
            const isOutboundTrigger = ['inactivity', 'lead_score', 'appointment', 'stage_change'].includes(wf.trigger_type)
            // inbound_message & keyword_trigger always have a live 24h session window
            const isInboundTrigger = ['inbound_message', 'keyword_trigger'].includes(wf.trigger_type)
            const hasSession = isInboundTrigger || (!manual && !isOutboundTrigger)
            const templateName = step.config?.template ?? step.config?.template_name

            if (templateName) {
              const variable1 = lead.name ?? lead.contact?.name ?? ''
              const ok = await sendWhatsAppTemplate(phone, templateName, variable1 ? [variable1] : [])
              if (ok) {
                actionTaken = actionTaken || `Template "${templateName}" sent`
                whatsappSent = true
                logStep(si, step.type, 'success', `Template "${templateName}" sent via ${STEP_LABELS[step.type]}`, Date.now() - t0)
                const conv = (lead.conversations ?? [])[0]
                if (conv?.id) {
                  await supabase.from('messages').insert({
                    conversation_id: conv.id, direction: 'outbound',
                    content: `[Template: ${templateName}] Hi ${variable1}`,
                    sender_type: 'ai', status: 'sent',
                    metadata: { template: true, template_name: templateName, workflow_id: wf.id },
                    created_at: new Date().toISOString(),
                  })
                }
              } else {
                allErrors.push(`Template "${templateName}" failed for ${lead.name} (${phone})`)
                logStep(si, step.type, 'error', `WhatsApp API rejected template "${templateName}"`, Date.now() - t0)
              }
            } else if (!hasSession) {
              // No active 24h session – log as skipped (other steps still run)
              console.warn(`[workflow] Skipping WhatsApp step for ${lead.name} — no active session (manual=${manual}, trigger=${wf.trigger_type}). Use a Send Template step for outbound workflows.`)
              logStep(si, step.type, 'skipped',
                `No active WhatsApp session (trigger: ${wf.trigger_type}, manual: ${manual}). Add a Send Template step for outbound messaging.`,
                Date.now() - t0)
            } else {
              // Active session — generate a real AI reply from conversation context
              const conv = (lead.conversations ?? [])[0]
              const conversationHistory = conv?.id
                ? await fetchConversationMessages(conv.id)
                : []
              let msg: string
              try {
                msg = await generateAIReply(
                  step.type,
                  step.config?.agent ?? 'AI Assistant',
                  step.config?.goal,
                  lead,
                  conversationHistory
                )
              } catch (aiErr: any) {
                // Fallback to static message if AI call fails
                console.warn(`[workflow] AI reply failed for ${lead.name}: ${aiErr.message} — using fallback`)
                msg = buildMessage(wf.trigger_type, lead, steps)
              }
              const ok = await sendWhatsApp(phone, msg)
              if (ok) {
                actionTaken = actionTaken || `AI reply sent: "${msg.slice(0, 60)}…"`
                whatsappSent = true
                logStep(si, step.type, 'success',
                  `AI-generated reply sent (${conversationHistory.length} msg context): "${msg.slice(0, 100)}…"`,
                  Date.now() - t0)
                if (conv?.id) {
                  await supabase.from('messages').insert({
                    conversation_id: conv.id, direction: 'outbound',
                    content: msg, sender_type: 'ai', status: 'sent',
                    metadata: {
                      ai_generated: true,
                      agent_name: step.config?.agent ?? 'Workflow',
                      workflow_id: wf.id,
                      context_messages: conversationHistory.length,
                    },
                    created_at: new Date().toISOString(),
                  })
                }
              } else {
                allErrors.push(`Failed to send WhatsApp to ${lead.name} (${phone})`)
                logStep(si, step.type, 'error', `WhatsApp API call failed for ${phone}`, Date.now() - t0)
              }
            }
          }

          // ── send_options ──────────────────────────────────────────────────
          if (step.type === 'send_options') {
            const isOutboundTrigger2 = ['inactivity', 'lead_score', 'appointment', 'stage_change'].includes(wf.trigger_type)
            const isInboundTrigger2 = ['inbound_message', 'keyword_trigger'].includes(wf.trigger_type)
            const hasSession = isInboundTrigger2 || (!manual && !isOutboundTrigger2)
            if (!hasSession) {
              console.warn(`[workflow] Skipping send_options for ${lead.name} — no active session`)
              logStep(si, step.type, 'skipped', 'No active WhatsApp session for interactive buttons', Date.now() - t0)
            } else {
              const bodyText = resolveVariable(step.config?.body ?? 'Please choose an option:', lead)
              const rawOptions: string = step.config?.options ?? ''
              const buttons = rawOptions.split('\n').map((o: string) => o.trim()).filter(Boolean).slice(0, 3)
                .map((title: string, i: number) => ({ id: `opt_${i}`, title: title.substring(0, 20) }))
              if (buttons.length === 0) {
                allErrors.push(`send_options: no options configured for ${lead.name}`)
                logStep(si, step.type, 'error', 'No button options configured', Date.now() - t0)
              } else {
                try {
                  const { sendButtonMessage } = await import('@/lib/whatsapp')
                  await sendButtonMessage(phone, bodyText, buttons)
                  actionTaken = actionTaken || `Options sent: ${buttons.map(b => b.title).join(' / ')}`
                  whatsappSent = true
                  logStep(si, step.type, 'success', `Buttons sent: ${buttons.map(b => b.title).join(' | ')}`, Date.now() - t0)
                  const conv = (lead.conversations ?? [])[0]
                  if (conv?.id) {
                    await supabase.from('messages').insert({
                      conversation_id: conv.id, direction: 'outbound', type: 'interactive',
                      content: `${bodyText}\n${buttons.map(b => `• ${b.title}`).join('\n')}`,
                      sender_type: 'ai', status: 'sent',
                      metadata: { interactive: true, buttons, workflow_id: wf.id },
                      created_at: new Date().toISOString(),
                    })
                  }
                } catch (e: any) {
                  allErrors.push(`send_options failed for ${lead.name}: ${e.message}`)
                  logStep(si, step.type, 'error', `sendButtonMessage error: ${e.message}`, Date.now() - t0)
                }
              }
            }
          }

          // ── wait_for_reply ────────────────────────────────────────────────
          if (step.type === 'wait_for_reply') {
            const conv = (lead.conversations ?? [])[0]
            if (conv?.id) {
              const timeoutHours = Number(step.config?.timeout_hours ?? 24)
              await supabase.from('conversations').update({
                status: 'waiting', updated_at: new Date().toISOString(),
                metadata: {
                  waiting_since: new Date().toISOString(),
                  timeout_at: new Date(Date.now() + timeoutHours * 3600 * 1000).toISOString(),
                  workflow_id: wf.id,
                },
              }).eq('id', conv.id)
              actionTaken = actionTaken || `Waiting for reply (timeout: ${timeoutHours}h)`
              logStep(si, step.type, 'success', `Conversation set to "waiting" for up to ${timeoutHours}h`, Date.now() - t0)
            } else {
              logStep(si, step.type, 'skipped', 'No conversation found for this lead', Date.now() - t0)
            }
          }

          // ── create_task ───────────────────────────────────────────────────
          if (step.type === 'create_task') {
            const rawTitle = step.config?.title ?? 'Follow up with {{lead.name}}'
            const title = resolveVariable(rawTitle, lead)
            taskTitleForNotify = title
            const dueHours = Number(step.config?.due_hours ?? 2)
            await supabase.from('tasks').insert({
              title,
              priority: step.config?.priority ?? 'high',
              status: 'pending',
              lead_id: lead.id,
              ai_generated: true,
              due_date: new Date(Date.now() + dueHours * 60 * 60 * 1000).toISOString(),
              ai_reasoning: `Auto-created by workflow "${wf.name}"`,
              created_at: new Date().toISOString(),
            })
            actionTaken = actionTaken || `Task created: ${title}`
            taskCreated = true
            logStep(si, step.type, 'success',
              `Task "${title}" created (priority: ${step.config?.priority ?? 'high'}, due in ${dueHours}h)`,
              Date.now() - t0)

            // ── AUTO-NOTIFY LEAD VIA WHATSAPP when no message step already sent ──
            // If the workflow has no send_template / send_whatsapp step above this,
            // and we're in a context where we can use a template, send an auto-notification.
            const hasMessageStep = steps.some(s =>
              ['send_template', 'send_whatsapp', 'ai_outreach', 'ai_reply', 'send_options'].includes(s.type)
            )
            if (!hasMessageStep && !whatsappSent) {
              const ta = Date.now()
              // Try template first (works outside 24h window); fall back to plain text if in session
              const autoTemplate = process.env.WHATSAPP_TASK_NOTIFICATION_TEMPLATE ?? ''
              const name = lead.name ?? lead.contact?.name ?? ''
              if (autoTemplate) {
                const ok = await sendWhatsAppTemplate(phone, autoTemplate, name ? [name, title] : [title])
                if (ok) {
                  whatsappSent = true
                  logStep(si, 'auto_notify', 'success',
                    `Auto-notification template "${autoTemplate}" sent alongside task creation`, Date.now() - ta)
                  const conv = (lead.conversations ?? [])[0]
                  if (conv?.id) {
                    await supabase.from('messages').insert({
                      conversation_id: conv.id, direction: 'outbound', content: `[Auto-Task Notify] ${title}`,
                      sender_type: 'ai', status: 'sent',
                      metadata: { auto_task_notify: true, task_title: title, workflow_id: wf.id },
                      created_at: new Date().toISOString(),
                    })
                  }
                } else {
                  logStep(si, 'auto_notify', 'skipped',
                    `Template "${autoTemplate}" rejected — no auto-notification sent`, Date.now() - ta)
                }
              } else {
                // No template env var set — try plain text only if session is open
                const isOutbound = ['inactivity', 'lead_score', 'appointment', 'stage_change'].includes(wf.trigger_type)
                const isInbound = ['inbound_message', 'keyword_trigger'].includes(wf.trigger_type)
                const hasSession = isInbound || (!manual && !isOutbound)
                if (hasSession) {
                  const msg = buildTaskNotification(title, lead)
                  const ok = await sendWhatsApp(phone, msg)
                  if (ok) {
                    whatsappSent = true
                    logStep(si, 'auto_notify', 'success',
                      `Auto task-notification plain text sent: "${msg.slice(0, 80)}…"`, Date.now() - ta)
                    const conv = (lead.conversations ?? [])[0]
                    if (conv?.id) {
                      await supabase.from('messages').insert({
                        conversation_id: conv.id, direction: 'outbound', content: msg,
                        sender_type: 'ai', status: 'sent',
                        metadata: { auto_task_notify: true, task_title: title, workflow_id: wf.id },
                        created_at: new Date().toISOString(),
                      })
                    }
                  } else {
                    logStep(si, 'auto_notify', 'skipped',
                      'Plain text send failed. Set WHATSAPP_TASK_NOTIFICATION_TEMPLATE for outbound delivery.', Date.now() - ta)
                  }
                } else {
                  logStep(si, 'auto_notify', 'skipped',
                    'No active session & no WHATSAPP_TASK_NOTIFICATION_TEMPLATE set. Set env var to enable outbound task notifications.',
                    Date.now() - ta)
                }
              }
            }
          }

          // ── update_lead ───────────────────────────────────────────────────
          if (step.type === 'update_lead') {
            const patch: Record<string, any> = {}
            if (step.config?.stage) patch.stage = step.config.stage
            if (step.config?.urgency) patch.urgency = step.config.urgency
            if (Object.keys(patch).length > 0) {
              await supabase.from('leads').update(patch).eq('id', lead.id)
              const summary = Object.entries(patch).map(([k, v]) => `${k} → ${v}`).join(', ')
              actionTaken = actionTaken || `Lead updated: ${summary}`
              logStep(si, step.type, 'success', `Lead fields updated: ${summary}`, Date.now() - t0)
            } else {
              logStep(si, step.type, 'skipped', 'No fields configured to update', Date.now() - t0)
            }
          }

          // ── notify ────────────────────────────────────────────────────────
          if (step.type === 'notify') {
            const msg = resolveVariable(step.config?.message ?? '', lead)
            console.log(`[notify] ${msg}`)
            actionTaken = actionTaken || `Notification: ${msg}`
            logStep(si, step.type, 'success', `Team notified: "${msg.slice(0, 80)}"`, Date.now() - t0)
          }

          // ── update_appointment ────────────────────────────────────────────
          if (step.type === 'update_appointment' && step.config?.reminder_sent) {
            await supabase.from('appointments')
              .update({ reminder_sent: true })
              .eq('lead_id', lead.id)
              .eq('status', 'scheduled')
            actionTaken = actionTaken || 'Appointment reminder marked'
            logStep(si, step.type, 'success', 'Appointment reminder_sent = true', Date.now() - t0)
          }

        } catch (stepErr: any) {
          allErrors.push(`Step "${step.type}" failed for ${lead.name}: ${stepErr.message}`)
          logStep(si, step.type, 'error', `Exception: ${stepErr.message}`, Date.now() - t0)
        }
      }

      if (actionTaken) {
        triggered++
        leadExecutions.push({
          leadId: lead.id,
          name: lead.name ?? 'Unknown',
          phone,
          steps: stepLogs,
          whatsappSent,
          taskCreated,
        })
      } else {
        skipped++
      }
    }

    // 4. Build execution record
    const execRecord: ExecutionRecord = {
      runId: `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      workflowId: wf.id,
      workflowName: wf.name,
      triggeredAt: new Date().toISOString(),
      durationMs: Date.now() - runStart,
      triggered,
      skipped,
      errors: allErrors,
      leads: leadExecutions,
    }

    // 5. Persist execution log — store last 20 runs in workflow.execution_logs JSONB
    const existingLogs: ExecutionRecord[] = Array.isArray(wf.execution_logs)
      ? wf.execution_logs
      : (typeof wf.execution_logs === 'string'
          ? JSON.parse(wf.execution_logs || '[]')
          : [])
    const updatedLogs = [execRecord, ...existingLogs].slice(0, 20)

    await supabase
      .from('workflows')
      .update({
        run_count: (wf.run_count ?? 0) + triggered,
        success_count: (wf.success_count ?? 0) + triggered,
        last_run_at: new Date().toISOString(),
        execution_logs: updatedLogs,
      })
      .eq('id', wf.id)

    return NextResponse.json({
      data: {
        triggered,
        skipped,
        errors: allErrors,
        // Legacy shape for RunResultsModal
        leads: leadExecutions.map(l => ({
          name: l.name,
          phone: l.phone,
          action: l.steps.filter(s => s.status === 'success').map(s => s.message).join(' · ').slice(0, 120) || 'No actions',
        })),
        // Full execution record for new Executions tab
        execution: execRecord,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
