import { NextRequest, NextResponse } from 'next/server'
import { buildCustomerProfile } from '@/lib/features'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get('contact_id')
  if (!contactId) return NextResponse.json({ error: 'contact_id required' }, { status: 400 })
  const profile = await buildCustomerProfile(contactId)
  return NextResponse.json({ data: profile })
}

export async function POST(req: NextRequest) {
  const { contact_id } = await req.json()
  if (!contact_id) return NextResponse.json({ error: 'contact_id required' }, { status: 400 })
  const profile = await buildCustomerProfile(contact_id)
  return NextResponse.json({ data: profile }, { status: 201 })
}
