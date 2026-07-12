import { NextRequest, NextResponse } from 'next/server'
import { getLogs, clearLogs, addLog } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    const logs = getLogs()
    return NextResponse.json({
      success: true,
      logs
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, level, category, message, details } = body

    if (action === 'clear') {
      clearLogs()
      addLog('info', 'general', 'Logs cleared by administrator.')
      return NextResponse.json({ success: true, message: 'Logs cleared successfully' })
    }

    if (action === 'log') {
      addLog(level || 'info', category || 'general', message || 'Manual log entry', details)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
