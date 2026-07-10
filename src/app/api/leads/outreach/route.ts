// POST /api/leads/outreach
// Kicks off AI-driven qualification outreach for a list of lead IDs.
// For each lead:
//   1. Upserts a contact + conversation row
//   2. Sends the opening WhatsApp message (template if no session, plain text if test mode)
//   3. Stores the outbound message so the AI can continue the thread on reply
//
// Body: { lead_ids: string[], message?: string, use_template?: boolean, template_name?: string }

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import { sendTextMessage, sendTemplateMessage } from '@/lib/whatsapp'

const QUALIFICATION_OPENER = (name: string) =>
  `Hi ${name}! 👋 I'm reaching out from StrixMind — we help businesses like yours automate client acquisition and workflows using AI.\n\nCould I ask — are you currently looking to grow your client base or streamline your business operations? 😊`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lead_ids, message, use_template, template_name, template_language = 'en_US' } = body

    if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
      return NextResponse.json({ error: 'lead_ids array is required' }, { status: 400 })
    }

    const db = createSupabaseServiceClient()

    // Fetch all requested leads with their contacts
    const { data: leads, error: leadsErr } = await db
      .from('leads')
      .select('*, contact:contacts(*)')
      .in('id', lead_ids)

    if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 })

    const results: { lead_id: string; name: string; phone: string; status: string; error?: string }[] = []

    for (const lead of leads ?? []) {
      const phone = lead.contact?.phone ?? lead.phone
      const name  = lead.contact?.name  ?? lead.name ?? 'there'

      if (!phone) {
        results.push({ lead_id: lead.id, name, phone: '', status: 'skipped', error: 'No phone number' })
        continue
      }

      try {
        // 1. Ensure contact row exists
        const { data: contact } = await db
          .from('contacts')
          .upsert({ phone, name }, { onConflict: 'phone' })
          .select()
          .single()

        if (!contact) throw new Error('Could not upsert contact')

        // 2. Find or create an open conversation for this contact
        let { data: conv } = await db
          .from('conversations')
          .select('*')
          .eq('contact_id', contact.id)
          .in('status', ['open', 'waiting'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        const openingText = message ?? QUALIFICATION_OPENER(name)

        if (!conv) {
          const { data: newConv } = await db
            .from('conversations')
            .insert({
              contact_id: contact.id,
              lead_id: lead.id,
              status: 'open',
              priority: 'medium',
              ai_auto_reply: true,
              last_message_at: new Date().toISOString(),
              last_message_preview: openingText.substring(0, 100),
              unread_count: 0,
            })
            .select()
            .single()
          conv = newConv
        } else {
          // Re-enable AI and link lead if not already linked
          await db.from('conversations').update({
            ai_auto_reply: true,
            lead_id: lead.id,
            status: 'open',
            last_message_at: new Date().toISOString(),
            last_message_preview: openingText.substring(0, 100),
            updated_at: new Date().toISOString(),
          }).eq('id', conv.id)
        }

        if (!conv) throw new Error('Could not create conversation')

        // 3. Send the WhatsApp message
        let sent = false
        if (use_template && template_name) {
          try {
            await sendTemplateMessage(phone, template_name, template_language, [
              { type: 'body', parameters: [{ type: 'text', text: name }] },
            ])
            sent = true
          } catch (tErr: any) {
            throw new Error(`Template send failed: ${tErr.message}`)
          }
        } else {
          // Plain text — works if this is a test number or within 24h session
          await sendTextMessage(phone, openingText)
          sent = true
        }

        // 4. Store the outbound message in DB
        if (sent) {
          await db.from('messages').insert({
            conversation_id: conv.id,
            direction: 'outbound',
            sender_type: 'ai',
            sender_name: 'StrixMind AI',
            type: 'text',
            content: use_template && template_name ? `[Template: ${template_name}]` : openingText,
            status: 'sent',
            metadata: {
              outreach: true,
              qualification: true,
              template: use_template ?? false,
              template_name: template_name ?? null,
            },
          })

          // 5. Update lead stage to "contacted"
          await db.from('leads')
            .update({ stage: 'contacted', updated_at: new Date().toISOString() })
            .eq('id', lead.id)

          results.push({ lead_id: lead.id, name, phone, status: 'sent' })
        }

      } catch (err: any) {
        results.push({ lead_id: lead.id, name, phone, status: 'failed', error: err.message })
      }
    }

    const sent   = results.filter(r => r.status === 'sent').length
    const failed = results.filter(r => r.status === 'failed').length
    const skipped = results.filter(r => r.status === 'skipped').length

    return NextResponse.json({ data: { sent, failed, skipped, results } })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
