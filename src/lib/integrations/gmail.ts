// ─── Gmail sender via OAuth2 / App Password (Nodemailer) ──────────────────────
// Uses GMAIL_USER + GMAIL_APP_PASSWORD from env.
// Falls back gracefully if not configured — logs instead of crashing.

import nodemailer from 'nodemailer'

function getTransport() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return null
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })
}

export async function sendEmail(opts: {
  to: string
  subject: string
  text: string
  html?: string
}): Promise<{ ok: boolean; error?: string }> {
  const transport = getTransport()
  if (!transport) {
    console.warn('[gmail] GMAIL_USER / GMAIL_APP_PASSWORD not configured — skipping email')
    return { ok: false, error: 'Gmail not configured' }
  }
  try {
    await transport.sendMail({
      from: `StrixMind <${process.env.GMAIL_USER}>`,
      ...opts,
    })
    return { ok: true }
  } catch (err: any) {
    console.error('[gmail] Send failed:', err.message)
    return { ok: false, error: err.message }
  }
}
