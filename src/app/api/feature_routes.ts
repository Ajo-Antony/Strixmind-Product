/**
 * /api/campaigns/analytics/route.ts  — Feature 7
 * /api/ai/costs/route.ts             — Feature 11
 * /api/notifications/route.ts        — Feature 9
 * /api/appointments/reminders/route.ts — Feature 10
 * /api/memory/route.ts               — Feature 12
 *
 * Each is a separate file — this file contains all five for brevity.
 * Split into individual files matching the folder structure.
 */

// ─────────────────────────────────────────────────────────────────
// FILE: src/app/api/campaigns/analytics/route.ts
// ─────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import {
  computeCampaignMetrics,
  getAICostSummary,
  sendNotification,
  runAppointmentReminderJob,
  buildCustomerProfile,
  checkUsageLimits,
  createStripeCheckoutSession,
  type PlanId,
} from '@/lib/features'

export async function campaignAnalyticsGET(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    const metrics = await computeCampaignMetrics(id)
    return NextResponse.json({ data: metrics })
  }

  // All campaigns with metrics
  const { data: campaigns } = await db
    .from('campaigns')
    .select('id, name, status, open_rate, reply_rate, conversion_rate, ai_optimisation_suggestion')
    .order('created_at', { ascending: false })

  return NextResponse.json({ data: campaigns })
}

export async function campaignAnalyticsPOST(req: NextRequest) {
  const { campaign_id } = await req.json()
  if (!campaign_id) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
  const metrics = await computeCampaignMetrics(campaign_id)
  return NextResponse.json({ data: metrics })
}

// ─────────────────────────────────────────────────────────────────
// FILE: src/app/api/ai/costs/route.ts
// ─────────────────────────────────────────────────────────────────
export async function aiCostsGET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const days = Number(searchParams.get('days') ?? '30')
  const summary = await getAICostSummary(days)
  return NextResponse.json({ data: summary })
}

// ─────────────────────────────────────────────────────────────────
// FILE: src/app/api/notifications/route.ts
// ─────────────────────────────────────────────────────────────────
export async function notificationsGET(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unread') === 'true'
  const recipient = searchParams.get('recipient')

  let query = db
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (unreadOnly) query = query.eq('read', false)
  if (recipient)  query = query.eq('recipient', recipient)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function notificationsPOST(req: NextRequest) {
  const payload = await req.json()
  await sendNotification(payload)
  return NextResponse.json({ data: { sent: true } }, { status: 201 })
}

export async function notificationsPATCH(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { id, all_read } = await req.json()

  if (all_read) {
    await db.from('notifications').update({ read: true }).eq('read', false)
    return NextResponse.json({ data: { marked_all_read: true } })
  }
  if (id) {
    await db.from('notifications').update({ read: true }).eq('id', id)
    return NextResponse.json({ data: { marked_read: id } })
  }
  return NextResponse.json({ error: 'id or all_read required' }, { status: 400 })
}

// ─────────────────────────────────────────────────────────────────
// FILE: src/app/api/appointments/reminders/route.ts
// ─────────────────────────────────────────────────────────────────
export async function appointmentRemindersGET(req: NextRequest) {
  // Triggered by cron or manual run
  const result = await runAppointmentReminderJob()
  return NextResponse.json({ data: result })
}

// ─────────────────────────────────────────────────────────────────
// FILE: src/app/api/memory/route.ts
// ─────────────────────────────────────────────────────────────────
export async function memoryGET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get('contact_id')
  if (!contactId) return NextResponse.json({ error: 'contact_id required' }, { status: 400 })
  const profile = await buildCustomerProfile(contactId)
  return NextResponse.json({ data: profile })
}

export async function memoryPOST(req: NextRequest) {
  const { contact_id } = await req.json()
  if (!contact_id) return NextResponse.json({ error: 'contact_id required' }, { status: 400 })
  const profile = await buildCustomerProfile(contact_id)
  return NextResponse.json({ data: profile }, { status: 201 })
}

// ─────────────────────────────────────────────────────────────────
// FILE: src/app/api/billing/route.ts  (Feature 8)
// ─────────────────────────────────────────────────────────────────
export async function billingGET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') ?? 'default'
  const usage = await checkUsageLimits(orgId)
  return NextResponse.json({ data: usage })
}

export async function billingPOST(req: NextRequest) {
  const { org_id, plan_id } = await req.json()
  if (!org_id || !plan_id) return NextResponse.json({ error: 'org_id and plan_id required' }, { status: 400 })
  try {
    const checkoutUrl = await createStripeCheckoutSession(org_id, plan_id as PlanId)
    return NextResponse.json({ data: { checkout_url: checkoutUrl } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
