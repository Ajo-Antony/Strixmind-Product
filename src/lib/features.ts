/**
 * lib/features.ts
 *
 * Centralised implementations for features 7–12:
 *   7.  Campaign analytics feedback loop
 *   8.  Payment & subscription flow (Stripe-ready)
 *   9.  Notification center (multi-channel)
 *   10. Appointment reminder automation
 *   11. AI cost monitoring
 *   12. Conversation memory layer
 *
 * Import individual functions from this file wherever needed.
 */
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from './supabase/server'
import { callAI } from './ai'
import { sendTextMessage } from './whatsapp'

// ══════════════════════════════════════════════════════════════════
// FEATURE 7 — Campaign Analytics Feedback Loop
// ══════════════════════════════════════════════════════════════════

export interface CampaignMetrics {
  campaign_id: string
  sent_count: number
  delivered_count: number
  read_count: number
  reply_count: number
  conversion_count: number
  open_rate: number         // delivered / sent
  reply_rate: number        // replied / delivered
  conversion_rate: number   // converted / sent
  cost_per_lead: number | null
  best_performing_message: string | null
  ai_optimisation_suggestion: string | null
}

export async function computeCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
  const db = createSupabaseServiceClient()

  // Try to fetch with campaign_leads join; fall back if the table doesn't exist yet
  let campaign: any = null
  const withJoin = await db
    .from('campaigns')
    .select('*, leads:campaign_leads(lead:leads(id, stage, ai_score))')
    .eq('id', campaignId)
    .single()

  if (withJoin.error && withJoin.error.message.includes('campaign_leads')) {
    // campaign_leads not created yet — fetch campaign without leads join
    const fallback = await db.from('campaigns').select('*').eq('id', campaignId).single()
    campaign = fallback.data ? { ...fallback.data, leads: [] } : null
  } else {
    campaign = withJoin.data
  }

  if (!campaign) throw new Error(`Campaign ${campaignId} not found`)

  // Count message statuses for this campaign
  const { data: messages } = await db
    .from('messages')
    .select('status, direction, content')
    .eq('metadata->>campaign_id', campaignId)

  const sent       = messages?.filter((m: any) => m.direction === 'outbound').length ?? 0
  const delivered  = messages?.filter((m: any) => ['delivered','read'].includes(m.status)).length ?? 0
  const read       = messages?.filter((m: any) => m.status === 'read').length ?? 0
  const replied    = messages?.filter((m: any) => m.direction === 'inbound').length ?? 0

  // Conversions = leads in the campaign who moved to converted/negotiation stage
  const leads = (campaign.leads ?? []).map((cl: any) => cl.lead)
  const converted = leads.filter((l: any) => ['converted','negotiation','scheduled'].includes(l?.stage ?? '')).length

  const openRate       = sent       > 0 ? +(delivered / sent * 100).toFixed(1)  : 0
  const replyRate      = delivered  > 0 ? +(replied   / delivered * 100).toFixed(1) : 0
  const conversionRate = sent       > 0 ? +(converted / sent * 100).toFixed(1) : 0

  // AI optimisation suggestion
  let suggestion: string | null = null
  if (sent > 10) {
    const perfData = `Campaign: "${campaign.name}". Sent: ${sent}, Open rate: ${openRate}%, Reply rate: ${replyRate}%, Conversion: ${conversionRate}%.`
    const { text } = await callAI({
      systemPrompt: 'You are a marketing AI. Give a 1-2 sentence specific suggestion to improve this campaign. Be concrete.',
      messages: [{ role: 'user', content: perfData }],
      temperature: 0.5,
      maxTokens: 120,
      taskType: 'analytics',
      size: 'small',
    })
    suggestion = text
  }

  // Persist metrics back to campaign
  await db.from('campaigns').update({
    open_rate:       openRate,
    reply_rate:      replyRate,
    conversion_rate: conversionRate,
    metrics: { sent, delivered, read, replied, converted },
    ai_optimisation_suggestion: suggestion,
    updated_at: new Date().toISOString(),
  }).eq('id', campaignId)

  return {
    campaign_id:                campaignId,
    sent_count:                 sent,
    delivered_count:            delivered,
    read_count:                 read,
    reply_count:                replied,
    conversion_count:           converted,
    open_rate:                  openRate,
    reply_rate:                 replyRate,
    conversion_rate:            conversionRate,
    cost_per_lead:              null,
    best_performing_message:    null,
    ai_optimisation_suggestion: suggestion,
  }
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 8 — Payment & Subscription Flow (Stripe-ready)
// ══════════════════════════════════════════════════════════════════

export const PLANS = {
  starter: { id: 'starter',   name: 'Starter',     price: 1999,  leads: 100,  ai_requests: 500,  agents: 1 },
  growth:  { id: 'growth',    name: 'Growth',       price: 4999,  leads: 500,  ai_requests: 2500, agents: 3 },
  pro:     { id: 'pro',       name: 'Pro',          price: 9999,  leads: 2000, ai_requests: 10000,agents: 10 },
  enterprise: { id: 'enterprise', name: 'Enterprise', price: -1, leads: -1, ai_requests: -1, agents: -1 },
} as const

export type PlanId = keyof typeof PLANS

export async function checkUsageLimits(orgId: string): Promise<{
  leads: { used: number; limit: number; exceeded: boolean }
  ai_requests: { used: number; limit: number; exceeded: boolean }
  agents: { used: number; limit: number; exceeded: boolean }
  plan: PlanId
}> {
  const db = createSupabaseServiceClient()

  const { data: org } = await db.from('organizations').select('plan, billing_period_start').eq('id', orgId).single()
  const plan = (org?.plan ?? 'starter') as PlanId
  const limits = PLANS[plan]

  // Count usage in current billing period
  const periodStart = org?.billing_period_start ?? new Date(new Date().setDate(1)).toISOString()

  const [{ count: leadsCount }, { count: aiCount }, { count: agentsCount }] = await Promise.all([
    db.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', periodStart),
    db.from('ai_requests').select('*', { count: 'exact', head: true }).gte('created_at', periodStart),
    db.from('agents').select('*', { count: 'exact', head: true }).eq('active', true),
  ])

  return {
    plan,
    leads:       { used: leadsCount ?? 0, limit: limits.leads,       exceeded: limits.leads > 0 && (leadsCount ?? 0) >= limits.leads },
    ai_requests: { used: aiCount ?? 0,    limit: limits.ai_requests, exceeded: limits.ai_requests > 0 && (aiCount ?? 0) >= limits.ai_requests },
    agents:      { used: agentsCount ?? 0, limit: limits.agents,     exceeded: limits.agents > 0 && (agentsCount ?? 0) >= limits.agents },
  }
}

export async function createStripeCheckoutSession(orgId: string, planId: PlanId): Promise<string> {
  const plan = PLANS[planId]
  if (!plan || plan.price < 0) throw new Error('Contact us for Enterprise pricing')

  // Stripe SDK integration point — replace with real stripe.checkout.sessions.create
  // import Stripe from 'stripe'
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  // const session = await stripe.checkout.sessions.create({ ... })

  // Mock for now — returns a checkout URL
  const mockUrl = `${process.env.NEXT_PUBLIC_APP_URL}/billing/checkout?plan=${planId}&org=${orgId}&price=${plan.price}`

  // Log intent in DB
  try {
    await createSupabaseServiceClient().from('billing_events').insert({
      org_id:     orgId,
      event_type: 'checkout_initiated',
      plan_id:    planId,
      amount:     plan.price,
      metadata:   { mock: true },
      created_at: new Date().toISOString(),
    })
  } catch { /* non-critical */ }

  return mockUrl
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 9 — Notification Center (multi-channel)
// ══════════════════════════════════════════════════════════════════

export type NotificationType =
  | 'task_due'
  | 'lead_assigned'
  | 'campaign_finished'
  | 'appointment_reminder'
  | 'ai_error'
  | 'handoff_assigned'
  | 'whatsapp_delivery_failed'
  | 'high_score_lead'
  | 'budget_alert'
  | 'usage_limit'

export interface NotificationPayload {
  type: NotificationType
  title: string
  body: string
  recipient_id?: string     // team member ID
  lead_id?: string
  conversation_id?: string
  channels: ('dashboard' | 'email' | 'whatsapp' | 'push')[]
  metadata?: Record<string, any>
}

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const db = createSupabaseServiceClient()

  // 1. Always persist to notification center (dashboard)
  try {
    await db.from('notifications').insert({
      type:            payload.type,
      title:           payload.title,
      body:            payload.body,
      recipient:       payload.recipient_id ?? null,
      lead_id:         payload.lead_id ?? null,
      conversation_id: payload.conversation_id ?? null,
      channels:        payload.channels,
      metadata:        payload.metadata ?? {},
      read:            false,
      created_at:      new Date().toISOString(),
    })
  } catch (err: any) { console.error('[notification] DB insert failed:', err.message) }

  // 2. WhatsApp (if channel requested and phone available)
  if (payload.channels.includes('whatsapp') && payload.recipient_id) {
    const { data: member } = await db
      .from('team_members')
      .select('phone, whatsapp_notifications')
      .eq('id', payload.recipient_id)
      .single()

    if (member?.phone && member?.whatsapp_notifications) {
      await sendTextMessage(
        member.phone,
        `🔔 *${payload.title}*\n${payload.body}`
      ).catch(err => console.error('[notification] WhatsApp send failed:', err.message))
    }
  }

  // 3. Email — plug in your email provider here
  if (payload.channels.includes('email') && payload.recipient_id) {
    // e.g.: await sendEmail({ to: member.email, subject: payload.title, body: payload.body })
    console.log(`[notification] Email queued for recipient ${payload.recipient_id}: ${payload.title}`)
  }

  // 4. Push — plug in Web Push / Expo / FCM here
  if (payload.channels.includes('push')) {
    // e.g.: await sendPushNotification({ ... })
    console.log(`[notification] Push queued: ${payload.title}`)
  }
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 10 — Appointment Reminder Automation
// ══════════════════════════════════════════════════════════════════

export async function runAppointmentReminderJob(): Promise<{
  reminders_sent: number
  no_shows_detected: number
  details: string[]
}> {
  const db = createSupabaseServiceClient()
  const now = new Date()
  const details: string[] = []
  let remindersSent = 0
  let noShows = 0

  // Fetch upcoming appointments
  const { data: appointments } = await db
    .from('appointments')
    .select('*, lead:leads(name, phone, contact:contacts(phone))')
    .eq('status', 'scheduled')
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', new Date(now.getTime() + 25 * 3600_000).toISOString())
    .order('scheduled_at', { ascending: true })

  for (const appt of appointments ?? []) {
    const phone = (appt.lead as any)?.phone ?? (appt.lead as any)?.contact?.phone
    if (!phone) continue

    const apptTime = new Date(appt.scheduled_at)
    const hoursUntil = (apptTime.getTime() - now.getTime()) / 3600_000

    // 24h reminder
    if (hoursUntil >= 23 && hoursUntil <= 25 && !appt.reminder_24h_sent) {
      const msg = `Hi ${(appt.lead as any)?.name ?? 'there'}! 🌸\n\nThis is a friendly reminder that you have an appointment with us tomorrow at ${apptTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.\n\nPlease reply *CONFIRM* to confirm or *RESCHEDULE* if needed. We look forward to seeing you! 💫`
      await sendTextMessage(phone, msg).catch(() => {})
      await db.from('appointments').update({ reminder_24h_sent: true }).eq('id', appt.id)
      remindersSent++
      details.push(`24h reminder → ${(appt.lead as any)?.name}`)
    }

    // 2h reminder
    if (hoursUntil >= 1.8 && hoursUntil <= 2.2 && !appt.reminder_2h_sent) {
      const msg = `Hi ${(appt.lead as any)?.name ?? 'there'}! ✨\n\nJust a reminder — your appointment is in about 2 hours at ${apptTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.\n\nSee you soon! 🌹`
      await sendTextMessage(phone, msg).catch(() => {})
      await db.from('appointments').update({ reminder_2h_sent: true }).eq('id', appt.id)
      remindersSent++
      details.push(`2h reminder → ${(appt.lead as any)?.name}`)
    }

    // Confirmation request (48h before, if not confirmed)
    if (hoursUntil >= 47 && hoursUntil <= 49 && !appt.confirmation_requested && appt.status !== 'confirmed') {
      const msg = `Hi ${(appt.lead as any)?.name ?? 'there'}! 💐\n\nYour appointment is in 2 days. Could you please confirm your attendance?\n\nReply *YES* to confirm or *NO* to cancel. Thank you! 🙏`
      await sendTextMessage(phone, msg).catch(() => {})
      await db.from('appointments').update({ confirmation_requested: true }).eq('id', appt.id)
      remindersSent++
      details.push(`Confirmation request → ${(appt.lead as any)?.name}`)
    }
  }

  // Detect no-shows (appointment was yesterday, still 'scheduled')
  const { data: past } = await db
    .from('appointments')
    .select('*, lead:leads(id, name)')
    .eq('status', 'scheduled')
    .lt('scheduled_at', new Date(now.getTime() - 3600_000).toISOString())
    .gt('scheduled_at', new Date(now.getTime() - 25 * 3600_000).toISOString())

  for (const appt of past ?? []) {
    await db.from('appointments').update({ status: 'no_show', updated_at: now.toISOString() }).eq('id', appt.id)
    const leadId = (appt.lead as any)?.id
    if (leadId) {
      try {
        await db.from('tasks').insert({
          title:        `Follow up no-show: ${(appt.lead as any)?.name}`,
          lead_id:      leadId,
          priority:     'high',
          due_date:     new Date(now.getTime() + 3600_000).toISOString(),
          ai_generated: true,
          ai_reasoning: `Appointment on ${appt.scheduled_at} was missed.`,
          status:       'pending',
        })
      } catch { /* non-critical */ }
    }
    noShows++
    details.push(`No-show detected → ${(appt.lead as any)?.name}`)
  }

  return { reminders_sent: remindersSent, no_shows_detected: noShows, details }
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 11 — AI Cost Monitoring
// ══════════════════════════════════════════════════════════════════

// Cost per 1000 tokens (USD) — update as pricing changes
const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4o':             { input: 0.005,  output: 0.015 },
  'gpt-4o-mini':        { input: 0.00015,output: 0.0006 },
  'gpt-4-turbo':        { input: 0.01,   output: 0.03 },
  'claude-3-5-sonnet':  { input: 0.003,  output: 0.015 },
  'claude-3-haiku':     { input: 0.00025,output: 0.00125 },
  'gemini-1.5-pro':     { input: 0.00125,output: 0.005 },
  'command-r-plus':     { input: 0.003,  output: 0.015 },
  'command-r':          { input: 0.0005, output: 0.0015 },
  default:              { input: 0.001,  output: 0.003 },
}

export function calculateRequestCost(model: string, promptTokens: number, completionTokens: number): number {
  const rates = TOKEN_COSTS[model] ?? TOKEN_COSTS.default
  return (promptTokens / 1000) * rates.input + (completionTokens / 1000) * rates.output
}

export async function getAICostSummary(days = 30): Promise<{
  total_cost_usd: number
  total_requests: number
  total_tokens: number
  cost_by_model: Record<string, number>
  cost_by_task: Record<string, number>
  daily_spend: { date: string; cost: number }[]
  budget_alert: boolean
  projected_monthly_cost: number
}> {
  const db = createSupabaseServiceClient()
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  const { data: requests } = await db
    .from('ai_requests')
    .select('model, task_type, prompt_tokens, completion_tokens, cost_usd, created_at, success')
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  if (!requests?.length) {
    return {
      total_cost_usd: 0, total_requests: 0, total_tokens: 0,
      cost_by_model: {}, cost_by_task: {}, daily_spend: [],
      budget_alert: false, projected_monthly_cost: 0,
    }
  }

  let totalCost = 0
  let totalTokens = 0
  const costByModel: Record<string, number> = {}
  const costByTask: Record<string, number> = {}
  const dailyMap: Record<string, number> = {}

  for (const req of requests) {
    const cost = req.cost_usd ?? calculateRequestCost(
      req.model ?? 'default',
      req.prompt_tokens ?? 0,
      req.completion_tokens ?? 0
    )
    totalCost += cost
    totalTokens += (req.prompt_tokens ?? 0) + (req.completion_tokens ?? 0)

    const model = req.model ?? 'unknown'
    const task  = req.task_type ?? 'unknown'
    const day   = req.created_at.slice(0, 10)

    costByModel[model] = (costByModel[model] ?? 0) + cost
    costByTask[task]   = (costByTask[task] ?? 0) + cost
    dailyMap[day]      = (dailyMap[day] ?? 0) + cost
  }

  const dailySpend = Object.entries(dailyMap)
    .map(([date, cost]) => ({ date, cost: +cost.toFixed(4) }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const avgDailyCost = totalCost / days
  const projectedMonthly = +(avgDailyCost * 30).toFixed(2)

  // Check against budget (set via env or org settings)
  const monthlyBudget = Number(process.env.AI_MONTHLY_BUDGET_USD ?? 50)
  const budgetAlert = projectedMonthly > monthlyBudget * 0.8

  if (budgetAlert) {
    try {
      await sendNotification({
        type:     'budget_alert',
        title:    '⚠️ AI Cost Alert',
        body:     `Projected monthly AI spend $${projectedMonthly} is approaching budget limit $${monthlyBudget}.`,
        channels: ['dashboard', 'email'],
      })
    } catch { /* non-critical */ }
  }

  return {
    total_cost_usd:          +totalCost.toFixed(4),
    total_requests:          requests.length,
    total_tokens:            totalTokens,
    cost_by_model:           Object.fromEntries(Object.entries(costByModel).map(([k,v]) => [k, +v.toFixed(4)])),
    cost_by_task:            Object.fromEntries(Object.entries(costByTask).map(([k,v]) => [k, +v.toFixed(4)])),
    daily_spend:             dailySpend,
    budget_alert:            budgetAlert,
    projected_monthly_cost:  projectedMonthly,
  }
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 12 — Conversation Memory Layer
// ══════════════════════════════════════════════════════════════════

export interface CustomerProfile {
  contact_id: string
  name: string | null
  // Short-term (current session)
  short_term: {
    last_message: string | null
    current_intent: string | null
    current_budget: number | null
    current_urgency: string | null
    session_start: string
  }
  // Long-term (persistent)
  long_term: {
    total_conversations: number
    first_contact: string | null
    last_contact: string | null
    budget_range_seen: number[]
    preferred_categories: string[]
    wedding_date: string | null
    purchase_history: string[]
    preferences: Record<string, any>
    notes: string[]
  }
  // Latest AI-generated profile
  ai_profile_summary: string | null
}

export async function buildCustomerProfile(contactId: string): Promise<CustomerProfile> {
  const db = createSupabaseServiceClient()

  // Fetch contact + all leads + all conversations
  const { data: contact } = await db
    .from('contacts')
    .select('*, leads:leads(intent, budget, urgency, sentiment, ai_score, ai_summary, stage, created_at, tags, metadata), conversations:conversations(id, ai_summary, created_at, last_message_preview, last_message_at)')
    .eq('id', contactId)
    .single()

  if (!contact) throw new Error(`Contact ${contactId} not found`)

  const leads: any[] = contact.leads ?? []
  const convs: any[] = contact.conversations ?? []

  // Short-term: most recent lead/conversation
  const latestLead = leads.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  const latestConv = convs.sort((a: any, b: any) => new Date(b.last_message_at ?? b.created_at).getTime() - new Date(a.last_message_at ?? a.created_at).getTime())[0]

  // Long-term aggregations
  const budgets = leads.map((l: any) => l.budget).filter(Boolean) as number[]
  const allTags = leads.flatMap((l: any) => l.tags ?? [])
  const categories = [...new Set(allTags)].slice(0, 10)

  // Check for wedding_date in custom_fields or lead metadata
  const weddingDate = contact.custom_fields?.wedding_date
    ?? leads.find((l: any) => l.metadata?.wedding_date)?.metadata?.wedding_date
    ?? null

  // Build AI profile summary
  let aiSummary: string | null = null
  if (convs.length > 0) {
    const profileData = `
Customer: ${contact.name ?? 'Unknown'}
Conversations: ${convs.length}
Lead stages: ${[...new Set(leads.map((l: any) => l.stage))].join(', ')}
Budgets seen: ₹${budgets.join(', ₹') || 'unknown'}
Interests: ${categories.join(', ') || 'unknown'}
Last summary: ${latestConv?.ai_summary ?? 'none'}
Wedding date: ${weddingDate ?? 'not mentioned'}
`
    try {
      const { text } = await callAI({
        systemPrompt: `You are a CRM memory agent. Write a 2-3 sentence customer profile that a sales agent can read before contacting this customer. Be specific and actionable.`,
        messages: [{ role: 'user', content: profileData }],
        temperature: 0.3,
        maxTokens: 150,
        taskType: 'memory',
        size: 'small',
      })
      aiSummary = text
    } catch { /* skip if AI fails */ }
  }

  // Persist updated profile
  await db.from('contacts').update({
    custom_fields: {
      ...(contact.custom_fields ?? {}),
      ai_profile_summary:   aiSummary,
      total_conversations:  convs.length,
      wedding_date:         weddingDate,
      last_profile_update:  new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  }).eq('id', contactId)

  return {
    contact_id: contactId,
    name:       contact.name,
    short_term: {
      last_message:    latestConv?.last_message_preview ?? null,
      current_intent:  latestLead?.intent ?? null,
      current_budget:  latestLead?.budget ?? null,
      current_urgency: latestLead?.urgency ?? null,
      session_start:   latestConv?.created_at ?? new Date().toISOString(),
    },
    long_term: {
      total_conversations:   convs.length,
      first_contact:         contact.created_at,
      last_contact:          latestConv?.last_message_at ?? null,
      budget_range_seen:     budgets,
      preferred_categories:  categories,
      wedding_date:          weddingDate,
      purchase_history:      leads.filter((l: any) => l.stage === 'converted').map((l: any) => l.ai_summary ?? l.intent).filter(Boolean),
      preferences:           contact.custom_fields?.preferences ?? {},
      notes:                 leads.map((l: any) => l.ai_summary).filter(Boolean),
    },
    ai_profile_summary: aiSummary,
  }
}

// Enrich orchestrator context with memory
export async function enrichContextWithMemory(
  conversationId: string,
  contactId: string
): Promise<string> {
  try {
    const profile = await buildCustomerProfile(contactId)
    const parts: string[] = []

    if (profile.ai_profile_summary) parts.push(`Customer profile: ${profile.ai_profile_summary}`)
    if (profile.long_term.wedding_date) parts.push(`Wedding date: ${profile.long_term.wedding_date}`)
    if (profile.short_term.current_budget) parts.push(`Budget: ₹${profile.short_term.current_budget}`)
    if (profile.short_term.current_intent) parts.push(`Current interest: ${profile.short_term.current_intent.replace(/_/g, ' ')}`)
    if (profile.long_term.total_conversations > 1) parts.push(`Returning customer (${profile.long_term.total_conversations} visits)`)

    return parts.join('. ')
  } catch {
    return ''
  }
}
