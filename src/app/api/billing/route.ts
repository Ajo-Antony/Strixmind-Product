import { NextRequest, NextResponse } from 'next/server'
import { checkUsageLimits, createStripeCheckoutSession, type PlanId } from '@/lib/features'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') ?? '00000000-0000-0000-0000-000000000001'
  const usage = await checkUsageLimits(orgId)
  return NextResponse.json({ data: usage })
}

export async function POST(req: NextRequest) {
  const { org_id, plan_id } = await req.json()
  if (!org_id || !plan_id)
    return NextResponse.json({ error: 'org_id and plan_id required' }, { status: 400 })
  try {
    const checkoutUrl = await createStripeCheckoutSession(org_id, plan_id as PlanId)
    return NextResponse.json({ data: { checkout_url: checkoutUrl } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
