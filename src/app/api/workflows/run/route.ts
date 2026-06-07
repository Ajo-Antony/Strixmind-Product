// Save this as: src/app/api/workflows/run/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Send a plain WhatsApp text message ───────────────────────────────────────
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

// ── Send a WhatsApp Template message ────────────────────────────────────────
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

// ── Build a personalised message for each trigger type ───────────────────────
function buildMessage(triggerType: string, lead: any, steps: any[]): string {
  const name = lead.name ?? lead.contact?.name ?? 'there'
  const outreachStep = steps.find(s => s.type === 'ai_outreach' || s.type === 'ai_reply')
  const goal = outreachStep?.config?.goal

  // Check if there's a custom send_whatsapp message
  const waStep = steps.find(s => s.type === 'send_whatsapp')
  if (waStep?.config?.message) {
    return waStep.config.message
      .replace(/\{\{lead\.name\}\}/g, name)
      .replace(/\{\{lead\.ai_score\}\}/g, String(lead.ai_score ?? 0))
      .replace(/\{\{1\}\}/g, name)
  }

  if (triggerType === 'inactivity') {
    return goal
      ? `Hi ${name}! ${goal} Let us know if there's anything we can help you with. 😊`
      : `Hi ${name}! We noticed we haven't heard from you in a while. We'd love to catch up — is there anything we can help you with today? Feel free to reply anytime! 😊`
  }
  if (triggerType === 'lead_score') {
    return goal
      ? `Hi ${name}! ${goal}`
      : `Hi ${name}! We've been reviewing your profile and think you'd be a great fit for what we offer. Would you like to schedule a quick call or visit us for a free consultation?`
  }
  if (triggerType === 'keyword_trigger' || triggerType === 'inbound_message') {
    return goal
      ? `Hi ${name}! ${goal}`
      : `Hi ${name}! Thanks for reaching out. We've received your message and will get back to you shortly. How can we help you today?`
  }
  if (triggerType === 'appointment') {
    return `Hi ${name}! This is a friendly reminder about your upcoming appointment with us. Please reply to confirm or let us know if you need to reschedule. 📅`
  }
  return goal
    ? `Hi ${name}! ${goal}`
    : `Hi ${name}! Just checking in from StrixMind. Let us know if there's anything we can help you with today!`
}

// ── Resolve template variable value ─────────────────────────────────────────
function resolveVariable(tpl: string, lead: any): string {
  const name = lead.name ?? lead.contact?.name ?? ''
  return tpl
    .replace(/\{\{lead\.name\}\}/g, name)
    .replace(/\{\{contact\.name\}\}/g, name)
    .replace(/\{\{lead\.ai_score\}\}/g, String(lead.ai_score ?? 0))
    .replace(/\{\{1\}\}/g, name)
}

// ── POST /api/workflows/run ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { workflow_id } = await req.json()
    if (!workflow_id) return NextResponse.json({ error: 'workflow_id required' }, { status: 400 })

    // 1. Fetch the workflow
    const { data: wf, error: wfErr } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflow_id)
      .single()

    if (wfErr || !wf) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    if (!wf.active) return NextResponse.json({ error: 'Workflow is paused' }, { status: 400 })

    const steps: any[] = Array.isArray(wf.steps) ? wf.steps : JSON.parse(wf.steps ?? '[]')
    const triggerConfig = wf.trigger_config ?? {}

    // 2. Find matching leads based on trigger type
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

    // keyword_trigger / inbound_message: manual runs match all open leads
    // (real-time keyword matching is handled by the webhook route)

    const { data: leads, error: leadsErr } = await leadsQuery.limit(50)
    if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 })

    const results: { name: string; phone: string; action: string }[] = []
    const errors: string[] = []
    let triggered = 0
    let skipped = 0

    // 3. Execute steps for each matching lead
    for (const lead of leads ?? []) {
      const phone = lead.contact?.phone ?? lead.phone
      if (!phone) { skipped++; continue }

      let actionTaken = ''

      for (const step of steps) {
        try {
          // ── send_template → WhatsApp approved template ────────────────────
          if (step.type === 'send_template') {
            const templateName = step.config?.template_name
            if (!templateName) { errors.push(`send_template: missing template_name for ${lead.name}`); continue }
            const variable1 = step.config?.variable_1
              ? resolveVariable(step.config.variable_1, lead)
              : (lead.name ?? lead.contact?.name ?? '')
            const variables = variable1 ? [variable1] : []
            const ok = await sendWhatsAppTemplate(phone, templateName, variables)
            if (ok) {
              actionTaken = actionTaken || `Template "${templateName}" sent`
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
              errors.push(`Template "${templateName}" failed for ${lead.name} (${phone})`)
            }
          }

          // ── send_whatsapp / ai_outreach / ai_reply → text or template message ─
          if (step.type === 'ai_outreach' || step.type === 'ai_reply' || step.type === 'send_whatsapp') {
            // send_whatsapp with a `template` config key → send as WhatsApp template
            const templateName = step.config?.template ?? step.config?.template_name
            if (step.type === 'send_whatsapp' && templateName) {
              const variable1 = lead.name ?? lead.contact?.name ?? ''
              const variables = variable1 ? [variable1] : []
              const ok = await sendWhatsAppTemplate(phone, templateName, variables)
              if (ok) {
                actionTaken = actionTaken || `Template "${templateName}" sent`
                const conv = (lead.conversations ?? [])[0]
                if (conv?.id) {
                  await supabase.from('messages').insert({
                    conversation_id: conv.id,
                    direction: 'outbound',
                    content: `[Template: ${templateName}] Hi ${variable1}`,
                    sender_type: 'ai',
                    status: 'sent',
                    metadata: { template: true, template_name: templateName, workflow_id: wf.id },
                    created_at: new Date().toISOString(),
                  })
                }
              } else {
                errors.push(`Template "${templateName}" failed for ${lead.name} (${phone})`)
              }
            } else {
              // Plain text message
              const msg = buildMessage(wf.trigger_type, lead, steps)
              const ok = await sendWhatsApp(phone, msg)
              if (ok) {
                actionTaken = actionTaken || `WhatsApp sent: "${msg.slice(0, 60)}…"`
                const conv = (lead.conversations ?? [])[0]
                if (conv?.id) {
                  await supabase.from('messages').insert({
                    conversation_id: conv.id,
                    direction: 'outbound',
                    content: msg,
                    sender_type: 'ai',
                    status: 'sent',
                    metadata: { outreach: true, workflow_id: wf.id, agent_name: step.config?.agent ?? 'Workflow' },
                    created_at: new Date().toISOString(),
                  })
                }
              } else {
                errors.push(`Failed to send WhatsApp to ${lead.name} (${phone})`)
              }
            }
          }

          // ── create_task ────────────────────────────────────────────────────
          if (step.type === 'create_task') {
            const title = (step.config?.title ?? 'Follow up with {{lead.name}}')
              .replace(/\{\{lead\.name\}\}/g, lead.name ?? 'lead')
              .replace(/\{\{lead\.ai_score\}\}/g, String(lead.ai_score ?? 0))
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
          }

          // ── update_lead ────────────────────────────────────────────────────
          if (step.type === 'update_lead') {
            const patch: Record<string, any> = {}
            if (step.config?.stage) patch.stage = step.config.stage
            if (step.config?.urgency) patch.urgency = step.config.urgency
            if (Object.keys(patch).length > 0) {
              await supabase.from('leads').update(patch).eq('id', lead.id)
              actionTaken = actionTaken || `Lead updated: ${Object.entries(patch).map(([k,v])=>`${k}→${v}`).join(', ')}`
            }
          }

          // ── notify ─────────────────────────────────────────────────────────
          if (step.type === 'notify') {
            const msg = (step.config?.message ?? '')
              .replace(/\{\{lead\.name\}\}/g, lead.name ?? '')
              .replace(/\{\{lead\.ai_score\}\}/g, String(lead.ai_score ?? 0))
            console.log(`[notify] ${msg}`)
            actionTaken = actionTaken || `Notification: ${msg}`
          }

          // ── update_appointment ─────────────────────────────────────────────
          if (step.type === 'update_appointment' && step.config?.reminder_sent) {
            // Mark the lead's next appointment as reminder sent
            await supabase.from('appointments')
              .update({ reminder_sent: true })
              .eq('lead_id', lead.id)
              .eq('status', 'scheduled')
            actionTaken = actionTaken || 'Appointment reminder marked'
          }

        } catch (stepErr: any) {
          errors.push(`Step "${step.type}" failed for ${lead.name}: ${stepErr.message}`)
        }
      }

      if (actionTaken) {
        triggered++
        results.push({ name: lead.name ?? 'Unknown', phone, action: actionTaken })
      } else {
        skipped++
      }
    }

    // 4. Update workflow run stats
    await supabase
      .from('workflows')
      .update({
        run_count: (wf.run_count ?? 0) + triggered,
        success_count: (wf.success_count ?? 0) + triggered,
        last_run_at: new Date().toISOString(),
      })
      .eq('id', wf.id)

    return NextResponse.json({
      data: { triggered, skipped, errors, leads: results },
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
