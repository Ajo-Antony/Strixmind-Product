import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import { sendTextMessage } from '@/lib/whatsapp'
import { runAppointmentReminderJob } from '@/lib/features'
import { addLog } from '@/lib/logger'

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}

async function handleCron(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const now = new Date()
  const logs: string[] = []

  const { searchParams } = new URL(req.url)
  const singleLeadId = searchParams.get('leadId')

  try {
    // 1. Run Appointment Reminders Job
    if (!singleLeadId) {
      const reminderResult = await runAppointmentReminderJob()
      if (reminderResult.reminders_sent > 0 || reminderResult.no_shows_detected > 0) {
        logs.push(`Reminders sent: ${reminderResult.reminders_sent}, No-shows: ${reminderResult.no_shows_detected}`)
        addLog('success', 'automation', 'Processed appointment reminder cron job successfully.', reminderResult)
      }
    }

    // 2. Fetch all leads with pending, genuine scheduled follow-ups
    let query = db
      .from('leads')
      .select('*, contact:contacts(*), conversations(*)')
      .neq('stage', 'converted')
      .neq('stage', 'closed')

    if (singleLeadId) {
      query = query.eq('id', singleLeadId)
    }

    const { data: leads, error: leadsErr } = await query

    if (leadsErr) {
      console.error('[cron] Error fetching leads:', leadsErr.message)
      return NextResponse.json({ error: leadsErr.message }, { status: 500 })
    }

    let followupsSent = 0

    for (const lead of leads ?? []) {
      const meta = lead.metadata ?? {}
      const isManualForced = !!singleLeadId
      
      // Check if it has a scheduled followup, not sent yet, and is genuine, OR if manually forced
      if (
        (isManualForced && meta.followup_message_draft) ||
        (meta.scheduled_followup_at &&
          !meta.followup_sent &&
          meta.is_genuine !== false &&
          meta.followup_message_draft)
      ) {
        const scheduledTime = meta.scheduled_followup_at ? new Date(meta.scheduled_followup_at) : new Date(0)
        
        if (isManualForced || scheduledTime <= now) {
          const phone = lead.contact?.phone ?? lead.phone
          if (!phone) continue

          const draft = meta.followup_message_draft
          
          // Send the message via WhatsApp
          const ok = await sendTextMessage(phone, draft).catch(() => false)
          
          if (ok) {
            followupsSent++
            logs.push(`Automated followup sent to ${lead.name} (${phone})`)
            addLog('success', 'automation', `Sent automated 24/7 followup message to ${lead.name}`, { phone, draft })

            // Find or create conversation for message storage
            let conv = lead.conversations?.[0]
            if (!conv) {
              const { data: list } = await db
                .from('conversations')
                .select('*')
                .eq('contact_id', lead.contact_id)
                .order('created_at', { ascending: false })
                .limit(1)
              conv = list?.[0]
            }

            if (conv) {
              // Store outbound follow-up message
              await db.from('messages').insert({
                conversation_id: conv.id,
                direction: 'outbound',
                sender_type: 'ai',
                sender_name: isManualForced ? 'StrixMind User-Triggered' : 'StrixMind Follow-up',
                type: 'text',
                content: draft,
                status: 'sent',
                metadata: { automated_followup: true, scheduled_for: meta.scheduled_followup_at, manual_override: isManualForced },
                created_at: new Date().toISOString(),
              }).catch(() => {})

              await db.from('conversations').update({
                last_message_at: new Date().toISOString(),
                last_message_preview: draft.substring(0, 100),
                updated_at: new Date().toISOString(),
              }).eq('id', conv.id).catch(() => {})
            }

            // Update lead metadata to mark as sent and progress stage to contacted
            const updatedMeta = {
              ...meta,
              followup_sent: true,
              followup_sent_at: new Date().toISOString(),
            }

            await db.from('leads').update({
              metadata: updatedMeta,
              stage: lead.stage === 'new' ? 'contacted' : lead.stage,
              updated_at: new Date().toISOString(),
            }).eq('id', lead.id).catch(() => {})
          } else {
            console.error(`[cron] Failed to send followup message to ${lead.name}`)
          }
        }
      }
    }

    if (followupsSent > 0) {
      logs.push(`Total automated followups processed: ${followupsSent}`)
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      logs,
      processed: followupsSent,
    })

  } catch (err: any) {
    console.error('[cron] Unhandled exception:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
