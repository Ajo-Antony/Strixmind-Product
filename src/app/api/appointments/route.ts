export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const upcoming = searchParams.get('upcoming')

  let query = db
    .from('appointments')
    .select('*, lead:leads(name, phone), contact:contacts(name, phone)')
    .order('scheduled_at', { ascending: true })

  if (upcoming === 'true') {
    query = query.gte('scheduled_at', new Date().toISOString()).eq('status', 'scheduled')
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const body = await req.json()
  const { data, error } = await db.from('appointments').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const body = await req.json()
  const { id, ...updates } = body
  const { data, error } = await db
    .from('appointments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { error } = await db.from('appointments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
