// POST /api/conversations/enable-ai
// Re-enables AI auto-reply on open/waiting conversations
// Body: { "all": true }  OR  { "conversation_id": "uuid" }

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const db = createSupabaseServiceClient()
    const body = await req.json().catch(() => ({}))

    if (body.conversation_id) {
      const { error } = await db
        .from('conversations')
        .update({ ai_auto_reply: true, updated_at: new Date().toISOString() })
        .eq('id', body.conversation_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data: { updated: 1 } })
    }

    if (body.all) {
      const { data, error } = await db
        .from('conversations')
        .update({ ai_auto_reply: true, updated_at: new Date().toISOString() })
        .in('status', ['open', 'waiting'])
        .select('id')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data: { updated: data?.length ?? 0 } })
    }

    return NextResponse.json({ error: 'Provide conversation_id or all: true' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
