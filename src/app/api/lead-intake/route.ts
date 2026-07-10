// ─── POST /api/lead-intake ────────────────────────────────────────────────────
// Public webhook — no auth required. Hit this from your website contact form.
//
// Expected body:
//   { first_name, email, phone?, last_name?, company?, message?, source? }
//
// What happens:
//   1. Validate & store lead in Supabase
//   2. Fan-out in parallel:
//        a) Gmail → send thank-you to lead
//        b) Gmail → notify your team
//        c) Apollo → enrich the contact profile
//   3. Sequential: HubSpot → create/update contact with enriched data
//   4. Fire-and-forget AI scoring

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import { sendEmail }             from '@/lib/integrations/gmail'
import { enrichByEmail }         from '@/lib/integrations/apollo'
import { createHubSpotContact }  from '@/lib/integrations/hubspot'

// ── CORS — allow requests from any origin (website forms) ────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const first_name = (body.first_name ?? body.firstName ?? '').trim()
    const last_name  = (body.last_name  ?? body.lastName  ?? '').trim()
    const email      = (body.email      ?? '').trim().toLowerCase()
    const phone      = (body.phone      ?? '').trim()
    const company    = (body.company    ?? body.business_name ?? '').trim()
    const message    = (body.message    ?? body.notes         ?? '').trim()
    const source     = (body.source     ?? 'website').trim()

    if (!first_name) return NextResponse.json({ error: 'first_name is required' }, { status: 400, headers: CORS })
    if (!email && !phone) return NextResponse.json({ error: 'email or phone is required' }, { status: 400, headers: CORS })

    const full_name = last_name ? `${first_name} ${last_name}` : first_name
    const db = createSupabaseServiceClient()

    // ── 1. Upsert contact ──────────────────────────────────────────────────
    // Never store a fake phone value — branch on whether phone was provided
    let contact: any = null
    if (phone) {
      const { data } = await db
        .from('contacts')
        .upsert({ phone, name: full_name, email: email || null }, { onConflict: 'phone' })
        .select().single()
      contact = data
    } else if (email) {
      const { data: existing } = await db.from('contacts').select('*').eq('email', email).maybeSingle()
      if (existing) {
        contact = existing
      } else {
        const { data } = await db
          .from('contacts')
          .insert({ phone: `em_${Date.now()}`, name: full_name, email })
          .select().single()
        contact = data
      }
    }

    // ── 2. Create lead ─────────────────────────────────────────────────────
    const { data: lead, error: leadErr } = await db
      .from('leads')
      .insert({
        name:       full_name,
        phone:      phone || email || 'unknown',
        email:      email || null,
        stage:      'new',
        source,
        notes:      [company && `Company: ${company}`, message].filter(Boolean).join('\n') || null,
        ai_score:   50,
        urgency:    'medium',
        confidence: 0.5,
        sentiment:  'neutral',
        contact_id: contact?.id ?? null,
      })
      .select()
      .single()

    if (leadErr) {
      console.error('[lead-intake] Lead insert failed:', leadErr.message)
      return NextResponse.json({ error: leadErr.message }, { status: 500, headers: CORS })
    }

    // Log the intake event
    try {
      await db.from('lead_intake_log').insert({
        lead_id:    lead.id,
        email,
        phone,
        full_name,
        source,
        raw_payload: body,
        status:     'received',
      })
    } catch { /* table may not exist yet — non-fatal */ }

    // ── 3. Fan-out in parallel ─────────────────────────────────────────────
    const teamEmail = process.env.TEAM_NOTIFICATION_EMAIL

    const [thankYouResult, teamNotifyResult, apolloResult] = await Promise.allSettled([

      // 3a. Thank-you email to lead
      email ? sendEmail({
        to:      email,
        subject: `Thanks for reaching out, ${first_name}!`,
        text:    `Hi ${first_name},\n\nThanks for reaching out to StrixMind! We've received your message and our team will get back to you within 24 hours.\n\nMeanwhile, feel free to reply to this email if you have any questions.\n\nBest,\nThe StrixMind Team`,
        html:    `<p>Hi <strong>${first_name}</strong>,</p>
<p>Thanks for reaching out to <strong>StrixMind</strong>! We've received your message and our team will get back to you within 24 hours.</p>
<p>Meanwhile, feel free to reply to this email if you have any questions.</p>
<p>Best,<br/>The StrixMind Team</p>`,
      }) : Promise.resolve({ ok: false, error: 'No email address' }),

      // 3b. Internal team notification
      teamEmail ? sendEmail({
        to:      teamEmail,
        subject: `🔔 New lead: ${full_name}${company ? ` — ${company}` : ''}`,
        text:    `New lead submitted via ${source}:\n\nName:    ${full_name}\nEmail:   ${email || 'N/A'}\nPhone:   ${phone || 'N/A'}\nCompany: ${company || 'N/A'}\nMessage: ${message || 'N/A'}\n\nView in dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
        html:    `<h3>New lead via <em>${source}</em></h3>
<table cellpadding="6">
  <tr><td><strong>Name</strong></td><td>${full_name}</td></tr>
  <tr><td><strong>Email</strong></td><td>${email || 'N/A'}</td></tr>
  <tr><td><strong>Phone</strong></td><td>${phone || 'N/A'}</td></tr>
  <tr><td><strong>Company</strong></td><td>${company || 'N/A'}</td></tr>
  <tr><td><strong>Message</strong></td><td>${message || 'N/A'}</td></tr>
</table>
<p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard">View in StrixMind Dashboard →</a></p>`,
      }) : Promise.resolve({ ok: false, error: 'TEAM_NOTIFICATION_EMAIL not configured' }),

      // 3c. Apollo enrichment
      email ? enrichByEmail(email) : Promise.resolve(null),
    ])

    const apolloData = apolloResult.status === 'fulfilled' ? apolloResult.value : null

    // ── 4. HubSpot — sequential after Apollo ─────────────────────────────
    let hubspotResult: { ok: boolean; id?: string; error?: string } = { ok: false, error: 'Skipped' }
    if (email) {
      hubspotResult = await createHubSpotContact({
        email,
        first_name,
        last_name:        last_name || apolloData?.last_name || null,
        phone:            phone || apolloData?.phone_numbers?.[0]?.raw_number || null,
        job_title:        apolloData?.title || null,
        company:          company || apolloData?.organization_name || null,
        city:             apolloData?.city || null,
        country:          apolloData?.country || null,
        linkedin_url:     apolloData?.linkedin_url || null,
        company_phone:    apolloData?.organization?.phone || null,
        company_linkedin: apolloData?.organization?.linkedin_url || null,
        website:          apolloData?.organization?.website_url || null,
        lead_source:      source,
      })
    }

    // ── 5. Update lead with enriched Apollo data ──────────────────────────
    if (apolloData) {
      const enrichedNotes = [
        lead.notes,
        apolloData.title             && `Title: ${apolloData.title}`,
        apolloData.organization_name && `Company: ${apolloData.organization_name}`,
        apolloData.city              && `Location: ${apolloData.city}${apolloData.country ? `, ${apolloData.country}` : ''}`,
        apolloData.linkedin_url      && `LinkedIn: ${apolloData.linkedin_url}`,
      ].filter(Boolean).join('\n')

      await db.from('leads').update({
        notes:      enrichedNotes,
        phone:      lead.phone || apolloData.phone_numbers?.[0]?.raw_number || lead.phone,
        updated_at: new Date().toISOString(),
      }).eq('id', lead.id)
    }

    // ── 6. AI scoring (fire-and-forget) ──────────────────────────────────
    scoreLeadAsync(lead.id, db).catch(() => {})

    // ── 7. Update intake log with results ────────────────────────────────
    try {
      await db.from('lead_intake_log').update({
        status:         'processed',
        thank_you_sent: thankYouResult.status === 'fulfilled' && (thankYouResult.value as any)?.ok,
        team_notified:  teamNotifyResult.status === 'fulfilled' && (teamNotifyResult.value as any)?.ok,
        apollo_enriched: !!apolloData,
        hubspot_id:     hubspotResult.id ?? null,
        processed_at:   new Date().toISOString(),
      }).eq('lead_id', lead.id)
    } catch { /* non-fatal */ }

    return NextResponse.json({
      success:  true,
      lead_id:  lead.id,
      pipeline: {
        thank_you_email: (thankYouResult.status === 'fulfilled' && (thankYouResult.value as any)?.ok) ? 'sent' : 'skipped',
        team_notify:     (teamNotifyResult.status === 'fulfilled' && (teamNotifyResult.value as any)?.ok) ? 'sent' : 'skipped',
        apollo_enriched: !!apolloData,
        hubspot:         hubspotResult.ok ? `created (${hubspotResult.id})` : hubspotResult.error ?? 'skipped',
      },
    }, { headers: CORS })

  } catch (err: any) {
    console.error('[lead-intake] Unhandled error:', err)
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS })
  }
}

// ─── Background AI scoring ────────────────────────────────────────────────────
async function scoreLeadAsync(leadId: string, db: any) {
  const { analyzeLeadFromConversation } = await import('@/lib/ai')
  const { data: lead } = await db.from('leads').select('*').eq('id', leadId).single()
  if (!lead) return
  const parts = [
    `My name is ${lead.name}.`,
    lead.phone  && `Phone: ${lead.phone}.`,
    lead.email  && `Email: ${lead.email}.`,
    lead.notes  && `Notes: ${lead.notes}.`,
    lead.source && `Source: ${lead.source}.`,
  ].filter(Boolean).join(' ')
  const analysis = await analyzeLeadFromConversation([{ role: 'user', content: parts }], undefined, leadId)
  await db.from('leads').update({
    ai_score:   analysis.ai_score,
    intent:     analysis.intent,
    urgency:    analysis.urgency,
    sentiment:  analysis.sentiment,
    confidence: analysis.confidence,
    ai_summary: analysis.summary,
    tags:       analysis.suggested_tags,
    updated_at: new Date().toISOString(),
  }).eq('id', leadId)
}
