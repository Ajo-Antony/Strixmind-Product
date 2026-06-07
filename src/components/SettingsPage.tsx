'use client'
import { useState } from 'react'
import { Settings, Webhook, Brain, MessageSquare, Database, CheckCircle, AlertCircle, Loader2, Copy } from 'lucide-react'
import { toast } from 'sonner'

function CopyField({ label, value, masked }: { label: string; value: string; masked?: boolean }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }
  const display = masked ? value.replace(/./g, (_, i) => i < 4 ? value[i] : '•').slice(0, 20) + '...' : value
  return (
    <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{display}</div>
      </div>
      <button onClick={copy} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/5 transition-colors flex-shrink-0 ml-2">
        {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />}
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState('Hello! This is a test message from StrixMind.')
  const [sending, setSending] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function sendTestMessage() {
    if (!testPhone) return toast.error('Enter a phone number')
    setSending(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: '__test__',
          content: testMsg,
          _test_phone: testPhone,
        }),
      })
      if (res.ok) {
        setTestResult({ ok: true, message: 'Message sent successfully via WhatsApp API' })
        toast.success('Test message sent!')
      } else {
        const data = await res.json()
        setTestResult({ ok: false, message: data.error ?? 'Failed to send' })
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message })
    } finally {
      setSending(false)
    }
  }

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/whatsapp`
    : 'https://yourdomain.com/api/webhooks/whatsapp'

  const sections = [
    {
      icon: Webhook,
      title: 'WhatsApp Configuration',
      color: '#22c55e',
      items: [
        { label: 'Webhook URL (paste in Meta Dashboard)', value: webhookUrl, masked: false },
        { label: 'Verify Token (set WHATSAPP_WEBHOOK_VERIFY_TOKEN in .env)', value: process.env.NEXT_PUBLIC_APP_URL ?? 'configure in .env.local', masked: false },
      ],
    },
    {
      icon: Brain,
      title: 'AI Provider',
      color: '#8b5cf6',
      items: [
        { label: 'Active Provider (AI_PROVIDER)', value: process.env.AI_PROVIDER ?? 'Set AI_PROVIDER in .env.local', masked: false },
        { label: 'Small Model (AI_MODEL_SMALL)', value: process.env.AI_MODEL_SMALL ?? 'Set AI_MODEL_SMALL in .env.local', masked: false },
        { label: 'Large Model (AI_MODEL_LARGE)', value: process.env.AI_MODEL_LARGE ?? 'Set AI_MODEL_LARGE in .env.local', masked: false },
      ],
    },
    {
      icon: Database,
      title: 'Supabase',
      color: '#3b82f6',
      items: [
        { label: 'Project URL', value: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'Not configured', masked: false },
        { label: 'Anon Key', value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'Not configured', masked: true },
      ],
    },
  ]

  const steps = [
    { n: 1, title: 'Run Supabase Schema', desc: 'Open Supabase → SQL Editor → paste supabase/schema.sql → Run' },
    { n: 2, title: 'Configure .env.local', desc: 'Fill all keys: Supabase URL + keys, WhatsApp token + phone ID, AI provider keys' },
    { n: 3, title: 'Set Webhook in Meta', desc: 'Go to Meta for Developers → WhatsApp → Configuration → paste your webhook URL + verify token' },
    { n: 4, title: 'Subscribe to webhook fields', desc: 'In Meta Dashboard enable: messages, message_deliveries, message_reads' },
    { n: 5, title: 'Send a WhatsApp message', desc: 'Message your WhatsApp Business number — it appears in Inbox automatically with AI analysis' },
  ]

  return (
    <div className="max-w-3xl space-y-5">
      {/* Setup Guide */}
      <div className="glass rounded-3xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4" style={{ color: '#22c55e' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Setup Guide</span>
        </div>
        <div className="space-y-3">
          {steps.map(step => (
            <div key={step.n} className="flex items-start gap-3 p-3 rounded-2xl"
              style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.08)' }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>{step.n}</div>
              <div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{step.title}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Config sections */}
      {sections.map(section => (
        <div key={section.title} className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <section.icon className="w-4 h-4" style={{ color: section.color }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{section.title}</span>
          </div>
          <div className="space-y-2">
            {section.items.map(item => <CopyField key={item.label} {...item} />)}
          </div>
        </div>
      ))}

      {/* WhatsApp test */}
      <div className="glass rounded-3xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-4 h-4" style={{ color: '#22c55e' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Test WhatsApp Connection</span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Recipient Phone (with country code)</label>
            <input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="919876543210"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Message</label>
            <textarea value={testMsg} onChange={e => setTestMsg(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
          </div>
          <button onClick={sendTestMessage} disabled={sending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white font-medium"
            style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            Send Test Message
          </button>
          {testResult && (
            <div className="flex items-center gap-2 p-3 rounded-xl"
              style={{ background: testResult.ok ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${testResult.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
              {testResult.ok
                ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                : <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#dc2626' }} />}
              <span className="text-xs" style={{ color: testResult.ok ? '#166534' : '#dc2626' }}>{testResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* .env.local reference */}
      <div className="glass rounded-3xl p-5">
        <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>.env.local Reference</div>
        <pre className="text-[11px] leading-relaxed p-4 rounded-2xl overflow-x-auto"
          style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
{`# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# WhatsApp Cloud API
WHATSAPP_API_TOKEN=EAAxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_BUSINESS_ACCOUNT_ID=9876543210
WHATSAPP_WEBHOOK_VERIFY_TOKEN=my_secret_token

# AI Provider (openai | anthropic | gemini)
AI_PROVIDER=openai
AI_MODEL_SMALL=gpt-4o-mini
AI_MODEL_LARGE=gpt-4o
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...`}
        </pre>
      </div>
    </div>
  )
}
