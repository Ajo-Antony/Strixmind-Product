import { NextRequest, NextResponse } from 'next/server'
import { runAppointmentReminderJob } from '@/lib/features'

// GET — run the reminder job (called by cron every 15 min)
export async function GET(_req: NextRequest) {
  const result = await runAppointmentReminderJob()
  return NextResponse.json({ data: result })
}
