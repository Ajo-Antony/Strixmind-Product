// GET /api/lead-intake/log  — returns recent intake events for the dashboard
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100)

  const { data, error } = await db
    .from('lead_intake_log')
    .select('*, lead:leads(name, ai_score, stage)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (error.message.includes('does not exist')) return NextResponse.json({ data: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}
