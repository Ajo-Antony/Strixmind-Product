import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const ENV_PATH = path.join(process.cwd(), '.env.local')

// Helper to read and parse .env.local
function readEnvFile(): Record<string, string> {
  try {
    if (!fs.existsSync(ENV_PATH)) return {}
    const content = fs.readFileSync(ENV_PATH, 'utf-8')
    const config: Record<string, string> = {}
    
    content.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) return
      const key = trimmed.slice(0, eqIdx).trim()
      let val = trimmed.slice(eqIdx + 1).trim()
      // Strip outer quotes if any
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      config[key] = val
    })
    return config
  } catch (err) {
    console.error('Error reading .env.local:', err)
    return {}
  }
}

// Helper to write to .env.local
function writeEnvFile(updates: Record<string, string>) {
  try {
    const current = readEnvFile()
    const merged = { ...current, ...updates }
    
    const lines: string[] = ['# StrixMind Persistent Connections (Auto-Generated)']
    Object.entries(merged).forEach(([key, val]) => {
      lines.push(`${key}="${val.replace(/"/g, '\\"')}"`)
    })
    
    fs.writeFileSync(ENV_PATH, lines.join('\n'), 'utf-8')
  } catch (err) {
    console.error('Error writing .env.local:', err)
    throw new Error('Failed to persist connection settings to disk')
  }
}

// Helper to mask sensitive keys
function maskValue(key: string, value: string | undefined): string {
  if (!value) return ''
  const lowerKey = key.toLowerCase()
  if (lowerKey.includes('key') || lowerKey.includes('token') || lowerKey.includes('password') || lowerKey.includes('secret')) {
    if (value.length <= 8) return '••••••••'
    return `${value.slice(0, 4)}••••${value.slice(-4)}`
  }
  return value
}

export async function GET(req: NextRequest) {
  try {
    const fileEnv = readEnvFile()
    const merged = {
      // Defaults from process.env
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      WHATSAPP_API_TOKEN: process.env.WHATSAPP_API_TOKEN || '',
      NEXT_PUBLIC_WHATSAPP_API_VERSION: process.env.NEXT_PUBLIC_WHATSAPP_API_VERSION || 'v19.0',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      COHERE_API_KEY: process.env.COHERE_API_KEY || '',
      GMAIL_USER: process.env.GMAIL_USER || '',
      GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD || '',
      TEAM_NOTIFICATION_EMAIL: process.env.TEAM_NOTIFICATION_EMAIL || '',
      APOLLO_API_KEY: process.env.APOLLO_API_KEY || '',
      HUBSPOT_PRIVATE_APP_TOKEN: process.env.HUBSPOT_PRIVATE_APP_TOKEN || '',
      // File-level overrides
      ...fileEnv,
    }

    // Mask sensitive fields for security
    const masked: Record<string, string> = {}
    const rawKeys: string[] = []
    
    Object.entries(merged).forEach(([key, val]) => {
      masked[key] = maskValue(key, val)
      if (val) {
        rawKeys.push(key)
      }
    })

    return NextResponse.json({
      success: true,
      connections: masked,
      rawConfiguredKeys: rawKeys, // tells us which ones are filled
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, payload } = body

    if (action === 'save') {
      if (!payload || typeof payload !== 'object') {
        return NextResponse.json({ error: 'Payload must be an object' }, { status: 400 })
      }
      
      // Clean updates, ignoring masked keys if they weren't edited (i.e. of format '••••')
      const envUpdates: Record<string, string> = {}
      Object.entries(payload).forEach(([key, val]) => {
        const strVal = String(val).trim()
        if (strVal && !strVal.includes('••••')) {
          envUpdates[key] = strVal
        }
      })

      writeEnvFile(envUpdates)

      // Apply dynamically to process.env so it works immediately without manual server reboot
      Object.entries(envUpdates).forEach(([key, val]) => {
        process.env[key] = val
      })

      return NextResponse.json({ success: true, message: 'Connections updated permanently' })
    }

    if (action === 'test') {
      const { type, config } = payload
      const start = Date.now()
      
      try {
        switch (type) {
          case 'supabase': {
            const url = config.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
            const key = config.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
            if (!url || !key) throw new Error('Missing Supabase URL or Service Role Key')
            
            const { createClient } = await import('@supabase/supabase-js')
            const client = createClient(url, key)
            // Try query to confirm
            const { error } = await client.from('leads').select('id').limit(1)
            // It succeeds if there is no network/auth error. Even if table is empty or missing,
            // standard schema.sql is provided.
            if (error && error.code !== 'PGRST116' && !error.message?.includes('does not exist')) {
              throw new Error(error.message)
            }
            break
          }
          
          case 'whatsapp': {
            const token = config.WHATSAPP_API_TOKEN || process.env.WHATSAPP_API_TOKEN
            const phoneId = config.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID
            const version = config.NEXT_PUBLIC_WHATSAPP_API_VERSION || process.env.NEXT_PUBLIC_WHATSAPP_API_VERSION || 'v19.0'
            
            if (!token || !phoneId) throw new Error('Missing Token or Phone Number ID')
            
            const testUrl = `https://graph.facebook.com/${version}/${phoneId}`
            const res = await fetch(testUrl, {
              headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (!res.ok) {
              throw new Error(data.error?.message || 'Meta API returned an error status')
            }
            break
          }
          
          case 'gemini': {
            const apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY
            if (!apiKey) throw new Error('Missing Gemini API Key')
            
            const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
            const res = await fetch(testUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: 'Respond with OK' }] }]
              })
            })
            const data = await res.json()
            if (!res.ok) {
              throw new Error(data.error?.message || 'Gemini API authentication failed')
            }
            break
          }

          case 'openai': {
            const apiKey = config.OPENAI_API_KEY || process.env.OPENAI_API_KEY
            if (!apiKey) throw new Error('Missing OpenAI API Key')
            
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 5
              })
            })
            const data = await res.json()
            if (!res.ok) {
              throw new Error(data.error?.message || 'OpenAI API authentication failed')
            }
            break
          }
          
          case 'gmail': {
            const user = config.GMAIL_USER || process.env.GMAIL_USER
            const pass = config.GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD
            if (!user || !pass) throw new Error('Missing Gmail Username or App Password')
            
            const nodemailer = await import('nodemailer')
            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: { user, pass }
            })
            await transporter.verify()
            break
          }
          
          case 'hubspot': {
            const token = config.HUBSPOT_PRIVATE_APP_TOKEN || process.env.HUBSPOT_PRIVATE_APP_TOKEN
            if (!token) throw new Error('Missing HubSpot Private App Token')
            
            const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
              headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (!res.ok) {
              throw new Error(data.message || 'HubSpot Token verification failed')
            }
            break
          }
          
          case 'apollo': {
            const apiKey = config.APOLLO_API_KEY || process.env.APOLLO_API_KEY
            if (!apiKey) throw new Error('Missing Apollo API Key')
            
            const res = await fetch('https://api.apollo.io/v1/organizations/search', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              },
              body: JSON.stringify({ api_key: apiKey, q_organization_domains: 'google.com' })
            })
            const data = await res.json()
            if (!res.ok) {
              throw new Error(data.message || 'Apollo API key verification failed')
            }
            break
          }
          
          default:
            throw new Error(`Unknown connection type: ${type}`)
        }
        
        return NextResponse.json({
          success: true,
          latencyMs: Date.now() - start,
          message: 'Connection verified successfully!'
        })
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          latencyMs: Date.now() - start,
          error: err.message || 'Verification failed'
        })
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
