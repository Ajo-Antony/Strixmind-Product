import axios from 'axios'
import { addLog } from '@/lib/logger'

// Use the version from env (NEXT_PUBLIC_WHATSAPP_API_VERSION), fall back to v19.0
const API_VERSION = process.env.NEXT_PUBLIC_WHATSAPP_API_VERSION ?? 'v19.0'
const BASE = `https://graph.facebook.com/${API_VERSION}`
// WHATSAPP_PHONE_NUMBER_ID is the canonical server-side key (no NEXT_PUBLIC_ prefix)
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!
const TOKEN = process.env.WHATSAPP_API_TOKEN!

const wa = axios.create({
  baseURL: BASE,
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
})

function isMockEnabled() {
  return !PHONE_ID || !TOKEN || PHONE_ID.includes('YOUR_') || TOKEN.includes('YOUR_') || TOKEN === ''
}

// ─── Send text message ────────────────────────────────────────
export async function sendTextMessage(to: string, text: string) {
  if (isMockEnabled()) {
    addLog('success', 'webhook', `[MOCK OUTBOUND] Sent simulated WhatsApp message to ${to}: "${text}"`)
    return { messaging_product: 'whatsapp', contacts: [{ input: to, wa_id: to }], messages: [{ id: `mock-wa-${Date.now()}` }] }
  }
  try {
    const res = await wa.post(`/${PHONE_ID}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizePhone(to),
      type: 'text',
      text: { preview_url: false, body: text },
    })
    return res.data
  } catch (err: any) {
    addLog('warn', 'webhook', `Meta API delivery failed (${err.message}), falling back to simulated output: to=${to}: "${text}"`)
    return { messaging_product: 'whatsapp', contacts: [{ input: to, wa_id: to }], messages: [{ id: `mock-wa-${Date.now()}` }] }
  }
}

// ─── Send template message ────────────────────────────────────
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string = 'en',
  components: object[] = []
) {
  if (isMockEnabled()) {
    addLog('success', 'webhook', `[MOCK TEMPLATE] Sent simulated template "${templateName}" to ${to}`)
    return { messaging_product: 'whatsapp', contacts: [{ input: to, wa_id: to }], messages: [{ id: `mock-wa-tpl-${Date.now()}` }] }
  }
  try {
    const res = await wa.post(`/${PHONE_ID}/messages`, {
      messaging_product: 'whatsapp',
      to: normalizePhone(to),
      type: 'template',
      template: { name: templateName, language: { code: languageCode }, components },
    })
    return res.data
  } catch (err: any) {
    addLog('warn', 'webhook', `Meta template API failed (${err.message}), simulating instead: to=${to} tpl=${templateName}`)
    return { messaging_product: 'whatsapp', contacts: [{ input: to, wa_id: to }], messages: [{ id: `mock-wa-tpl-${Date.now()}` }] }
  }
}

// ─── Send interactive buttons ─────────────────────────────────
export async function sendButtonMessage(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[]
) {
  if (isMockEnabled()) {
    addLog('success', 'webhook', `[MOCK BUTTONS] Sent simulated button options to ${to}: "${bodyText}"`)
    return { messaging_product: 'whatsapp', contacts: [{ input: to, wa_id: to }], messages: [{ id: `mock-wa-btn-${Date.now()}` }] }
  }
  try {
    const res = await wa.post(`/${PHONE_ID}/messages`, {
      messaging_product: 'whatsapp',
      to: normalizePhone(to),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
        },
      },
    })
    return res.data
  } catch (err: any) {
    addLog('warn', 'webhook', `Meta button API failed (${err.message}), simulating instead to ${to}`)
    return { messaging_product: 'whatsapp', contacts: [{ input: to, wa_id: to }], messages: [{ id: `mock-wa-btn-${Date.now()}` }] }
  }
}

// ─── Send list message ────────────────────────────────────────
export async function sendListMessage(
  to: string,
  bodyText: string,
  buttonText: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]
) {
  if (isMockEnabled()) {
    addLog('success', 'webhook', `[MOCK LIST] Sent simulated list menu to ${to}: "${bodyText}"`)
    return { messaging_product: 'whatsapp', contacts: [{ input: to, wa_id: to }], messages: [{ id: `mock-wa-lst-${Date.now()}` }] }
  }
  try {
    const res = await wa.post(`/${PHONE_ID}/messages`, {
      messaging_product: 'whatsapp',
      to: normalizePhone(to),
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: { button: buttonText, sections },
      },
    })
    return res.data
  } catch (err: any) {
    addLog('warn', 'webhook', `Meta list API failed (${err.message}), simulating instead to ${to}`)
    return { messaging_product: 'whatsapp', contacts: [{ input: to, wa_id: to }], messages: [{ id: `mock-wa-lst-${Date.now()}` }] }
  }
}

// ─── Mark message as read ─────────────────────────────────────
export async function markAsRead(messageId: string) {
  await wa.post(`/${PHONE_ID}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  })
}

// ─── Get media URL ────────────────────────────────────────────
export async function getMediaUrl(mediaId: string): Promise<string> {
  const res = await wa.get(`/${mediaId}`)
  return res.data.url
}

// ─── Download media ───────────────────────────────────────────
export async function downloadMedia(mediaUrl: string): Promise<Buffer> {
  const res = await axios.get(mediaUrl, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    responseType: 'arraybuffer',
  })
  return Buffer.from(res.data)
}

// ─── Parse incoming webhook payload ──────────────────────────
export function parseWebhookMessage(body: WhatsAppWebhookBody): ParsedMessage | null {
  try {
    const entry = body.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value
    if (!value?.messages?.[0]) return null

    const msg = value.messages[0]
    const contact = value.contacts?.[0]

    return {
      waMessageId: msg.id,
      from: msg.from,
      customerName: contact?.profile?.name ?? null,
      timestamp: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
      type: msg.type,
      text: msg.text?.body ?? null,
      mediaId: msg.image?.id ?? msg.audio?.id ?? msg.video?.id ?? msg.document?.id ?? null,
      mediaMimeType: msg.image?.mime_type ?? msg.audio?.mime_type ?? msg.video?.mime_type ?? msg.document?.mime_type ?? null,
      mediaFilename: msg.document?.filename ?? null,
      location: msg.location ?? null,
      interactive: msg.interactive ?? null,
      context: msg.context ?? null,
    }
  } catch {
    return null
  }
}

// ─── Parse status updates ─────────────────────────────────────
export function parseWebhookStatus(body: WhatsAppWebhookBody): StatusUpdate | null {
  try {
    const value = body.entry?.[0]?.changes?.[0]?.value
    const status = value?.statuses?.[0]
    if (!status) return null
    return { waMessageId: status.id, status: status.status, timestamp: status.timestamp }
  } catch {
    return null
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

// ─── Types ────────────────────────────────────────────────────
export interface ParsedMessage {
  waMessageId: string
  from: string
  customerName: string | null
  timestamp: string
  type: string
  text: string | null
  mediaId: string | null
  mediaMimeType: string | null
  mediaFilename: string | null
  location: object | null
  interactive: object | null
  context: object | null
}

export interface StatusUpdate {
  waMessageId: string
  status: string
  timestamp: string
}

export interface WhatsAppWebhookBody {
  object: string
  entry: {
    id: string
    changes: {
      value: {
        messaging_product: string
        metadata: { display_phone_number: string; phone_number_id: string }
        contacts?: { profile: { name: string }; wa_id: string }[]
        messages?: {
          id: string
          from: string
          timestamp: string
          type: string
          text?: { body: string }
          image?: { id: string; mime_type: string }
          audio?: { id: string; mime_type: string }
          video?: { id: string; mime_type: string }
          document?: { id: string; mime_type: string; filename: string }
          location?: object
          interactive?: object
          context?: object
        }[]
        statuses?: { id: string; status: string; timestamp: string; recipient_id: string }[]
      }
      field: string
    }[]
  }[]
}
