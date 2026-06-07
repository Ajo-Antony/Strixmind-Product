import { NextRequest, NextResponse } from 'next/server'
import { getAICostSummary } from '@/lib/features'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const days = Number(searchParams.get('days') ?? '30')
  const summary = await getAICostSummary(days)
  return NextResponse.json({ data: summary })
}
