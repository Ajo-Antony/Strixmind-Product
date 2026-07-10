import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let query = db
    .from('tasks')
    .select('*, lead:leads(name, phone)')
    .order('due_date', { ascending: true })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const body = await req.json()

  const { data, error } = await db.from('tasks').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  if (updates.status === 'done') updates.completed_at = new Date().toISOString()

  const { data, error } = await db
    .from('tasks')
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
  const action = searchParams.get('action')

  // Bulk cleanup: remove duplicate pending AI tasks keeping only the latest per lead+workflow
  if (action === 'cleanup_duplicates') {
    // Find all AI-generated pending tasks, group by lead_id + ai_reasoning prefix
    const { data: allTasks } = await db
      .from('tasks')
      .select('id, lead_id, ai_reasoning, created_at')
      .eq('ai_generated', true)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    const seen = new Set<string>()
    const toDelete: string[] = []
    for (const t of allTasks ?? []) {
      const key = `${t.lead_id}::${(t.ai_reasoning ?? '').substring(0, 60)}`
      if (seen.has(key)) {
        toDelete.push(t.id)
      } else {
        seen.add(key)
      }
    }

    if (toDelete.length > 0) {
      await db.from('tasks').delete().in('id', toDelete)
    }
    return NextResponse.json({ ok: true, deleted: toDelete.length })
  }

  // Bulk cleanup: remove tasks with unresolved template variables like {{contact.name}}
  if (action === 'cleanup_unresolved') {
    const { data: badTasks } = await db
      .from('tasks')
      .select('id')
      .like('title', '%{{%')
    const ids = (badTasks ?? []).map((t: any) => t.id)
    if (ids.length > 0) await db.from('tasks').delete().in('id', ids)
    return NextResponse.json({ ok: true, deleted: ids.length })
  }

  // Bulk delete by ids array
  const body = await req.json().catch(() => null)
  if (body?.ids?.length) {
    await db.from('tasks').delete().in('id', body.ids)
    return NextResponse.json({ ok: true, deleted: body.ids.length })
  }

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { error } = await db.from('tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}