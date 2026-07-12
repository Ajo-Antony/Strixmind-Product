export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/features'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unread') === 'true'
  const recipient  = searchParams.get('recipient')

  let query = db.from('notifications').select('*').order('created_at', { ascending: false }).limit(60)
  if (unreadOnly) query = query.eq('read', false)
  if (recipient)  query = query.eq('recipient', recipient)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const payload = await req.json()
  await sendNotification(payload)
  return NextResponse.json({ data: { sent: true } }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
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
