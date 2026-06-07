import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const stage = searchParams.get('stage')
  const search = searchParams.get('search')

  let query = db.from('leads').select('*').order('created_at', { ascending: false })
  if (stage) query = query.eq('stage', stage)
  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const headers = ['id', 'name', 'phone', 'email', 'budget', 'stage', 'ai_score', 'source', 'notes', 'urgency', 'sentiment', 'created_at']
  const csvRows = [headers.join(',')]
  for (const row of (data ?? [])) {
    const vals = headers.map(h => {
      const v = (row as any)[h]
      if (v === null || v === undefined) return ''
      const s = String(v)
      // Quote fields that contain commas or newlines
      if (s.includes(',') || s.includes('\n') || s.includes('"')) return `"${s.replace(/"/g, '""')}"`
      return s
    })
    csvRows.push(vals.join(','))
  }

  const csv = csvRows.join('\n')
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${date}.csv"`,
    },
  })
}