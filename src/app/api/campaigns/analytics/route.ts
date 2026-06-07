import { NextRequest, NextResponse } from 'next/server'
import { computeCampaignMetrics } from '@/lib/features'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (id) {
    const metrics = await computeCampaignMetrics(id)
    return NextResponse.json({ data: metrics })
  }
  const { data } = await db.from('campaigns').select('id, name, status, open_rate, reply_rate, conversion_rate, ai_optimisation_suggestion').order('created_at', { ascending: false })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const { campaign_id } = await req.json()
  if (!campaign_id) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
  const metrics = await computeCampaignMetrics(campaign_id)
  return NextResponse.json({ data: metrics })
}
