import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import { sendTextMessage } from '@/lib/whatsapp'
import { generateReplySuggestions } from '@/lib/ai'

export async function GET(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const conversationId = searchParams.get('conversation_id')
  if (!conversationId) return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 })

  const { data, error } = await db
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const body = await req.json()
  const { conversation_id, content, type = 'text', sender_name = 'Agent' } = body

  if (!conversation_id || !content) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Get conversation + contact
  const { data: conv } = await db
    .from('conversations')
    .select('*, contact:contacts(phone, name)')
    .eq('id', conversation_id)
    .single()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  // Send via WhatsApp API
  let waMessageId: string | null = null
  try {
    const phone = (conv.contact as any)?.phone
    if (phone) {
      const res = await sendTextMessage(phone, content)
      waMessageId = res?.messages?.[0]?.id ?? null
    }
  } catch (err: any) {
    console.error('WhatsApp send error:', err.message)
  }

  // Save message to DB
  const { data: message, error } = await db
    .from('messages')
    .insert({
      conversation_id,
      wa_message_id: waMessageId,
      direction: 'outbound',
      sender_type: 'agent',
      sender_name,
      type,
      content,
      status: waMessageId ? 'sent' : 'failed',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update conversation preview
  await db.from('conversations').update({
    last_message_at: new Date().toISOString(),
    last_message_preview: content.substring(0, 100),
    unread_count: 0,
    updated_at: new Date().toISOString(),
  }).eq('id', conversation_id)

  return NextResponse.json({ data: message })
}

// GET /api/messages/suggestions?conversation_id=xxx
export async function PUT(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const body = await req.json()
  const { conversation_id } = body

  // Get recent messages for context
  const { data: messages } = await db
    .from('messages')
    .select('content, direction, sender_name')
    .eq('conversation_id', conversation_id)
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: conv } = await db
    .from('conversations')
    .select('*, contact:contacts(name), lead:leads(intent, budget, urgency, ai_score)')
    .eq('id', conversation_id)
    .single()

  const history = (messages ?? [])
    .reverse()
    .map((m: any) => `${m.direction === 'inbound' ? 'Customer' : 'Agent'}: ${m.content}`)
    .join('\n')

  const contact = (conv as any)?.contact
  const lead = (conv as any)?.lead
  const leadContext = lead
    ? `Intent: ${lead.intent}, Budget: ₹${lead.budget ?? 'unknown'}, Score: ${lead.ai_score}/100`
    : 'New lead'

  const suggestions = await generateReplySuggestions(
    history,
    contact?.name ?? 'Customer',
    leadContext,
    conversation_id
  )

  return NextResponse.json({ data: suggestions })
}
