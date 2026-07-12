'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Settings, Webhook, Brain, MessageSquare, Database, CheckCircle2, 
  XCircle, AlertCircle, Loader2, Copy, Shield, RefreshCw, 
  Activity, ArrowRight, Sparkles, Mail, Link2, HelpCircle, Eye, EyeOff
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Utility Components ──────────────────────────────────────────────────────
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
    <div className="flex items-center justify-between p-3 rounded-xl transition-all hover:bg-black/5" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)' }}>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{display}</div>
      </div>
      <button onClick={copy} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/5 transition-colors flex-shrink-0 ml-2">
        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />}
      </button>
    </div>
  )
}

interface TestState {
  status: 'idle' | 'testing' | 'success' | 'error'
  latency: number | null
  error: string | null
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null) // specific pillar key or 'global'
  const [expandedPillar, setExpandedPillar] = useState<string | null>('database')
  
  // Form input states
  const [form, setForm] = useState<Record<string, string>>({
    NEXT_PUBLIC_SUPABASE_URL: '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    WHATSAPP_PHONE_NUMBER_ID: '',
    WHATSAPP_API_TOKEN: '',
    NEXT_PUBLIC_WHATSAPP_API_VERSION: 'v19.0',
    GEMINI_API_KEY: '',
    OPENAI_API_KEY: '',
    GMAIL_USER: '',
    GMAIL_APP_PASSWORD: '',
    TEAM_NOTIFICATION_EMAIL: '',
    APOLLO_API_KEY: '',
    HUBSPOT_PRIVATE_APP_TOKEN: '',
  })

  // Visibility states for passwords/keys
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})

  // Verification status map
  const [verification, setVerification] = useState<Record<string, TestState>>({
    supabase: { status: 'idle', latency: null, error: null },
    whatsapp: { status: 'idle', latency: null, error: null },
    gemini: { status: 'idle', latency: null, error: null },
    openai: { status: 'idle', latency: null, error: null },
    gmail: { status: 'idle', latency: null, error: null },
    hubspot: { status: 'idle', latency: null, error: null },
    apollo: { status: 'idle', latency: null, error: null },
  })

  // WhatsApp manual sending test
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState('Hello! This is a test message from StrixMind WhatsApp integration.')
  const [sendingTestMsg, setSendingTestMsg] = useState(false)
  const [testMsgResult, setTestMsgResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Fetch connection configs
  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/connections')
      const data = await res.json()
      if (data.success) {
        setForm(prev => ({
          ...prev,
          ...data.connections
        }))
        
        // Auto-detect connection state based on backend response
        const rawKeys: string[] = data.rawConfiguredKeys || []
        
        setVerification(prev => ({
          ...prev,
          supabase: {
            status: (rawKeys.includes('NEXT_PUBLIC_SUPABASE_URL') && rawKeys.includes('SUPABASE_SERVICE_ROLE_KEY')) ? 'success' : 'idle',
            latency: null,
            error: null
          },
          whatsapp: {
            status: (rawKeys.includes('WHATSAPP_API_TOKEN') && rawKeys.includes('WHATSAPP_PHONE_NUMBER_ID')) ? 'success' : 'idle',
            latency: null,
            error: null
          },
          gemini: {
            status: rawKeys.includes('GEMINI_API_KEY') ? 'success' : 'idle',
            latency: null,
            error: null
          },
          openai: {
            status: rawKeys.includes('OPENAI_API_KEY') ? 'success' : 'idle',
            latency: null,
            error: null
          },
          gmail: {
            status: (rawKeys.includes('GMAIL_USER') && rawKeys.includes('GMAIL_APP_PASSWORD')) ? 'success' : 'idle',
            latency: null,
            error: null
          },
          hubspot: {
            status: rawKeys.includes('HUBSPOT_PRIVATE_APP_TOKEN') ? 'success' : 'idle',
            latency: null,
            error: null
          },
          apollo: {
            status: rawKeys.includes('APOLLO_API_KEY') ? 'success' : 'idle',
            latency: null,
            error: null
          }
        }))
      }
    } catch (err: any) {
      toast.error('Failed to load credentials: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  // Save parameters permanently
  async function savePillar(pillarKeys: string[], label: string) {
    const payloadToSave: Record<string, string> = {}
    pillarKeys.forEach(key => {
      payloadToSave[key] = form[key]
    })

    setSaving(label)
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', payload: payloadToSave }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`${label} configurations saved permanently!`)
        fetchConnections()
      } else {
        toast.error(data.error || 'Failed to save settings')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(null)
    }
  }

  // Live Connection Testing
  async function verifyConnection(type: string, fields: string[]) {
    // Fill up mock testing state
    setVerification(prev => ({
      ...prev,
      [type]: { status: 'testing', latency: null, error: null }
    }))

    // Construct local payload to test (fallback to stored)
    const testConfig: Record<string, string> = {}
    fields.forEach(field => {
      testConfig[field] = form[field]
    })

    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          payload: { type, config: testConfig }
        })
      })
      const data = await res.json()
      
      if (data.success) {
        setVerification(prev => ({
          ...prev,
          [type]: { status: 'success', latency: data.latencyMs, error: null }
        }))
        toast.success(`Verified: ${type.toUpperCase()} connection successful! (${data.latencyMs}ms)`)
      } else {
        setVerification(prev => ({
          ...prev,
          [type]: { status: 'error', latency: data.latencyMs || null, error: data.error }
        }))
        toast.error(`${type.toUpperCase()} Verification Failed: ${data.error}`)
      }
    } catch (err: any) {
      setVerification(prev => ({
        ...prev,
        [type]: { status: 'error', latency: null, error: err.message }
      }))
      toast.error(err.message)
    }
  }

  // Send interactive message via actual endpoint
  async function sendTestMessage() {
    if (!testPhone) return toast.error('Enter a recipient phone number')
    setSendingTestMsg(true)
    setTestMsgResult(null)
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
        setTestMsgResult({ ok: true, message: 'Message successfully sent using Meta WhatsApp API!' })
        toast.success('Test message sent successfully!')
      } else {
        const data = await res.json()
        setTestMsgResult({ ok: false, message: data.error ?? 'Failed to deliver message' })
        toast.error(data.error ?? 'Connection failed')
      }
    } catch (err: any) {
      setTestMsgResult({ ok: false, message: err.message })
      toast.error(err.message)
    } finally {
      setSendingTestMsg(false)
    }
  }

  // Mask toggle helper
  const toggleVisibility = (key: string) => {
    setVisibleKeys(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Calculate Connection Score based on 4 key components
  const pillarsCount = 4
  let pillarsConnected = 0
  
  if (verification.supabase.status === 'success') pillarsConnected++
  if (verification.whatsapp.status === 'success') pillarsConnected++
  if (verification.gemini.status === 'success' || verification.openai.status === 'success') pillarsConnected++
  if (verification.gmail.status === 'success' || verification.hubspot.status === 'success' || verification.apollo.status === 'success') pillarsConnected++

  const scorePct = Math.round((pillarsConnected / pillarsCount) * 100)

  const steps = [
    { id: 'database', title: 'Database Configuration', desc: 'Secure Supabase client for analytics and log archiving.', icon: Database, color: '#3b82f6' },
    { id: 'whatsapp', title: 'WhatsApp Business API', desc: 'Direct webhook synchronization for real-time CRM updates.', icon: MessageSquare, color: '#22c55e' },
    { id: 'ai', title: 'AI Language Models', desc: 'Server-side Gemini & OpenAI routers for lead scoring.', icon: Brain, color: '#a855f7' },
    { id: 'integrations', title: 'External Integrations', desc: 'Connect outbound marketing and client pipeline tools.', icon: Webhook, color: '#f97316' }
  ]

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/whatsapp`
    : 'https://yourdomain.com/api/webhooks/whatsapp'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
      
      {/* LEFT COLUMN: CONNECTION SCORE & STEPS PROGRESS */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Connection Score Card */}
        <div className="glass rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-600">Workspace Health</span>
          </div>

          <div className="flex items-end justify-between mb-2">
            <div>
              <span className="text-3xl font-bold font-sans tracking-tight">{scorePct}%</span>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {pillarsConnected} of {pillarsCount} active connection categories
              </p>
            </div>
            <div className="text-right">
              {scorePct === 100 ? (
                <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded-full">
                  Fully Verified
                </span>
              ) : (
                <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-600 px-2.5 py-1 rounded-full">
                  Incomplete Setup
                </span>
              )}
            </div>
          </div>

          {/* Connection Progress Bar */}
          <div className="w-full h-3 bg-black/5 rounded-full overflow-hidden mt-3 relative">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${scorePct}%` }}
            />
          </div>

          <div className="mt-4 pt-4 border-t border-black/[0.04] grid grid-cols-2 gap-2 text-center">
            <div className="p-2 rounded-xl bg-black/[0.01]">
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>AI Scoring Engine</span>
              <p className="text-xs font-bold text-emerald-600 mt-0.5">
                {verification.gemini.status === 'success' || verification.openai.status === 'success' ? 'Active' : 'Offline'}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-black/[0.01]">
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>CRM Live Sync</span>
              <p className="text-xs font-bold text-emerald-600 mt-0.5">
                {verification.whatsapp.status === 'success' ? 'Synchronized' : 'Offline'}
              </p>
            </div>
          </div>
        </div>

        {/* Steps navigation checklist */}
        <div className="glass rounded-3xl p-5 space-y-2">
          <div className="text-xs font-bold px-1 mb-3 text-emerald-700 uppercase tracking-wide flex items-center justify-between">
            <span>Setup Steps Checklist</span>
            <span className="text-[11px] font-mono lowercase">v1.2</span>
          </div>

          {steps.map((step, idx) => {
            let activeState = 'idle'
            if (step.id === 'database') activeState = verification.supabase.status
            else if (step.id === 'whatsapp') activeState = verification.whatsapp.status
            else if (step.id === 'ai') activeState = (verification.gemini.status === 'success' || verification.openai.status === 'success') ? 'success' : 'idle'
            else if (step.id === 'integrations') activeState = (verification.gmail.status === 'success' || verification.hubspot.status === 'success' || verification.apollo.status === 'success') ? 'success' : 'idle'

            const isExpanded = expandedPillar === step.id

            return (
              <button 
                key={step.id}
                onClick={() => setExpandedPillar(step.id)}
                className="w-full flex items-start gap-3 p-3 rounded-2xl text-left transition-all duration-200"
                style={{ 
                  background: isExpanded ? 'rgba(34,197,94,0.06)' : 'rgba(0,0,0,0.01)',
                  border: isExpanded ? '1px solid rgba(34,197,94,0.15)' : '1px solid rgba(0,0,0,0.04)'
                }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ 
                    background: activeState === 'success' ? '#22c55e15' : 'rgba(0,0,0,0.05)', 
                    color: activeState === 'success' ? '#22c55e' : 'var(--text-muted)' 
                  }}
                >
                  {activeState === 'success' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{step.title}</span>
                    <span className="text-[9px] font-mono opacity-80 uppercase">
                      {activeState === 'success' ? 'Connected' : activeState === 'testing' ? 'Testing' : 'Required'}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{step.desc}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Security / Decryption Information Card */}
        <div className="glass rounded-3xl p-5 flex items-start gap-3 bg-black/[0.01]">
          <Shield className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Secure Storage Policies</span>
            <p className="text-[10.5px] mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              All variables are written safely into `.env.local` directly on the server container. Sensitive credentials are masked in the browser client and only processed during secure server execution.
            </p>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: INTERACTIVE PILLARS FORM */}
      <div className="lg:col-span-8 space-y-6">
        
        {loading ? (
          <div className="glass rounded-3xl p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Retrieving active workspace configurations...</span>
          </div>
        ) : (
          <>
            {/* PILLAR 1: DATABASE */}
            {expandedPillar === 'database' && (
              <div className="glass rounded-3xl p-6 space-y-5 animate-slide-up">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-500" />
                    <div>
                      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Supabase Database Integration</h2>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Ensures real-time lead analytics and conversation message storage.</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">Step 1</span>
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      NEXT_PUBLIC_SUPABASE_URL
                    </label>
                    <input 
                      type="text" 
                      value={form.NEXT_PUBLIC_SUPABASE_URL}
                      onChange={e => setForm(prev => ({ ...prev, NEXT_PUBLIC_SUPABASE_URL: e.target.value }))}
                      placeholder="https://yourproject.supabase.co" 
                      className="w-full px-3.5 py-2 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-emerald-500 transition-all font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      NEXT_PUBLIC_SUPABASE_ANON_KEY
                    </label>
                    <div className="relative">
                      <input 
                        type={visibleKeys.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "text" : "password"}
                        value={form.NEXT_PUBLIC_SUPABASE_ANON_KEY}
                        onChange={e => setForm(prev => ({ ...prev, NEXT_PUBLIC_SUPABASE_ANON_KEY: e.target.value }))}
                        placeholder="eyJhbGciOi..." 
                        className="w-full px-3.5 py-2 pr-10 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-emerald-500 transition-all font-mono"
                      />
                      <button onClick={() => toggleVisibility('NEXT_PUBLIC_SUPABASE_ANON_KEY')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5">
                        {visibleKeys.NEXT_PUBLIC_SUPABASE_ANON_KEY ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      SUPABASE_SERVICE_ROLE_KEY
                    </label>
                    <div className="relative">
                      <input 
                        type={visibleKeys.SUPABASE_SERVICE_ROLE_KEY ? "text" : "password"}
                        value={form.SUPABASE_SERVICE_ROLE_KEY}
                        onChange={e => setForm(prev => ({ ...prev, SUPABASE_SERVICE_ROLE_KEY: e.target.value }))}
                        placeholder="eyJhbGciOi... (service key for secure routing)" 
                        className="w-full px-3.5 py-2 pr-10 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-emerald-500 transition-all font-mono"
                      />
                      <button onClick={() => toggleVisibility('SUPABASE_SERVICE_ROLE_KEY')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5">
                        {visibleKeys.SUPABASE_SERVICE_ROLE_KEY ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Connection Status Panel */}
                {verification.supabase.status !== 'idle' && (
                  <div className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
                    verification.supabase.status === 'success' 
                      ? 'bg-emerald-50/70 border-emerald-100 text-emerald-800' 
                      : verification.supabase.status === 'error'
                      ? 'bg-red-50/70 border-red-100 text-red-800'
                      : 'bg-black/[0.01] border-black/[0.05] text-gray-600'
                  }`}>
                    {verification.supabase.status === 'testing' && <Loader2 className="w-4 h-4 animate-spin mt-0.5" />}
                    {verification.supabase.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />}
                    {verification.supabase.status === 'error' && <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
                    <div>
                      <span className="font-semibold block">
                        {verification.supabase.status === 'testing' && 'Verifying tables & service role clearances...'}
                        {verification.supabase.status === 'success' && `Connected Successfully! Latency: ${verification.supabase.latency}ms`}
                        {verification.supabase.status === 'error' && 'Database Handshake Failed'}
                      </span>
                      {verification.supabase.error && (
                        <p className="text-[11px] mt-1 font-mono opacity-80">{verification.supabase.error}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Form Buttons */}
                <div className="flex gap-2.5 pt-2">
                  <button 
                    onClick={() => verifyConnection('supabase', ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])}
                    disabled={verification.supabase.status === 'testing' || !form.NEXT_PUBLIC_SUPABASE_URL}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-black/5 hover:bg-black/10 border border-black/10 flex items-center gap-1.5 transition-all"
                  >
                    {verification.supabase.status === 'testing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-gray-500" />}
                    Test Handshake
                  </button>

                  <button 
                    onClick={() => savePillar(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'], 'Supabase Database')}
                    disabled={saving !== null || !form.NEXT_PUBLIC_SUPABASE_URL}
                    className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all"
                    style={{ background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)' }}
                  >
                    {saving === 'Supabase Database' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {saving === 'Supabase Database' ? 'Saving Override...' : 'Save & Connect Permanently'}
                  </button>
                </div>
              </div>
            )}

            {/* PILLAR 2: WHATSAPP */}
            {expandedPillar === 'whatsapp' && (
              <div className="glass rounded-3xl p-6 space-y-5 animate-slide-up">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-500" />
                    <div>
                      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>WhatsApp Business API Setup</h2>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Required for transmitting automation workflows & bidirectional chatbot conversations.</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">Step 2</span>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="p-3 rounded-2xl bg-black/5 border border-black/10 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Webhook className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Your Webhook Callback URL</span>
                    </div>
                    <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>Paste this inside the Facebook Developer Dashboard under WhatsApp API Webhooks configuration:</p>
                    <CopyField label="Meta Callback URL" value={webhookUrl} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                        WHATSAPP_PHONE_NUMBER_ID
                      </label>
                      <input 
                        type="text" 
                        value={form.WHATSAPP_PHONE_NUMBER_ID}
                        onChange={e => setForm(prev => ({ ...prev, WHATSAPP_PHONE_NUMBER_ID: e.target.value }))}
                        placeholder="15-digit Phone ID" 
                        className="w-full px-3.5 py-2 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-emerald-500 transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                        WHATSAPP_API_VERSION
                      </label>
                      <input 
                        type="text" 
                        value={form.NEXT_PUBLIC_WHATSAPP_API_VERSION}
                        onChange={e => setForm(prev => ({ ...prev, NEXT_PUBLIC_WHATSAPP_API_VERSION: e.target.value }))}
                        placeholder="v19.0" 
                        className="w-full px-3.5 py-2 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-emerald-500 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      WHATSAPP_API_TOKEN
                    </label>
                    <div className="relative">
                      <input 
                        type={visibleKeys.WHATSAPP_API_TOKEN ? "text" : "password"}
                        value={form.WHATSAPP_API_TOKEN}
                        onChange={e => setForm(prev => ({ ...prev, WHATSAPP_API_TOKEN: e.target.value }))}
                        placeholder="EAAxxxxx... permanent or temporary Meta access token" 
                        className="w-full px-3.5 py-2 pr-10 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-emerald-500 transition-all font-mono"
                      />
                      <button onClick={() => toggleVisibility('WHATSAPP_API_TOKEN')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5">
                        {visibleKeys.WHATSAPP_API_TOKEN ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Connection Status Panel */}
                {verification.whatsapp.status !== 'idle' && (
                  <div className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
                    verification.whatsapp.status === 'success' 
                      ? 'bg-emerald-50/70 border-emerald-100 text-emerald-800' 
                      : verification.whatsapp.status === 'error'
                      ? 'bg-red-50/70 border-red-100 text-red-800'
                      : 'bg-black/[0.01] border-black/[0.05] text-gray-600'
                  }`}>
                    {verification.whatsapp.status === 'testing' && <Loader2 className="w-4 h-4 animate-spin mt-0.5" />}
                    {verification.whatsapp.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />}
                    {verification.whatsapp.status === 'error' && <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
                    <div>
                      <span className="font-semibold block">
                        {verification.whatsapp.status === 'testing' && 'Verifying API access token on Meta servers...'}
                        {verification.whatsapp.status === 'success' && `Connected Successfully! Handshake Response received in ${verification.whatsapp.latency}ms`}
                        {verification.whatsapp.status === 'error' && 'WhatsApp API Connection Rejected'}
                      </span>
                      {verification.whatsapp.error && (
                        <p className="text-[11px] mt-1 font-mono opacity-80">{verification.whatsapp.error}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2.5 pt-2">
                  <button 
                    onClick={() => verifyConnection('whatsapp', ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_API_TOKEN', 'NEXT_PUBLIC_WHATSAPP_API_VERSION'])}
                    disabled={verification.whatsapp.status === 'testing' || !form.WHATSAPP_API_TOKEN}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-black/5 hover:bg-black/10 border border-black/10 flex items-center gap-1.5 transition-all"
                  >
                    {verification.whatsapp.status === 'testing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-gray-500" />}
                    Verify Token
                  </button>

                  <button 
                    onClick={() => savePillar(['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_API_TOKEN', 'NEXT_PUBLIC_WHATSAPP_API_VERSION'], 'WhatsApp CRM')}
                    disabled={saving !== null || !form.WHATSAPP_API_TOKEN}
                    className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all"
                    style={{ background: 'linear-gradient(135deg,#15803d,#22c55e)' }}
                  >
                    {saving === 'WhatsApp CRM' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {saving === 'WhatsApp CRM' ? 'Saving Override...' : 'Save & Connect Permanently'}
                  </button>
                </div>

                {/* Additional manual test panel if verified */}
                {verification.whatsapp.status === 'success' && (
                  <div className="pt-4 border-t border-black/[0.04] space-y-3">
                    <div className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Transmit Interactive Live Test Message</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Recipient Number (with country code)</label>
                        <input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="919876543210"
                          className="w-full px-3 py-1.5 rounded-xl text-xs outline-none bg-black/5 border border-black/10" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Text Template Body</label>
                        <textarea value={testMsg} onChange={e => setTestMsg(e.target.value)} rows={2}
                          className="w-full px-3 py-1.5 rounded-xl text-xs outline-none resize-none bg-black/5 border border-black/10" />
                      </div>
                    </div>

                    <button onClick={sendTestMessage} disabled={sendingTestMsg}
                      className="px-4 py-1.5 rounded-xl text-xs text-white font-medium flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 transition-colors">
                      {sendingTestMsg ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
                      Dispatch Test Message
                    </button>

                    {testMsgResult && (
                      <div className={`p-2.5 rounded-xl text-[11px] flex items-center gap-2 ${testMsgResult.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
                        {testMsgResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                        <span>{testMsgResult.message}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* PILLAR 3: AI MODEL PROVIDERS */}
            {expandedPillar === 'ai' && (
              <div className="glass rounded-3xl p-6 space-y-5 animate-slide-up">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-500" />
                    <div>
                      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>AI Orchestration Engine (Gemini & OpenAI)</h2>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Primary model controllers responsible for lead auto-scoring, sentiment auditing, and suggestions.</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100">Step 3</span>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="p-4 rounded-3xl bg-purple-500/5 border border-purple-500/10 flex gap-3">
                    <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-purple-900">
                      We support fully routing requests server-side. For maximum speed and accuracy, configure Google Gemini or OpenAI. Leave the other field blank if you only plan to use one.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1.5 text-purple-950">
                      GEMINI_API_KEY (Recommended)
                    </label>
                    <div className="relative">
                      <input 
                        type={visibleKeys.GEMINI_API_KEY ? "text" : "password"}
                        value={form.GEMINI_API_KEY}
                        onChange={e => setForm(prev => ({ ...prev, GEMINI_API_KEY: e.target.value }))}
                        placeholder="AIzaSy... Google Gemini token" 
                        className="w-full px-3.5 py-2 pr-10 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-purple-500 transition-all font-mono"
                      />
                      <button onClick={() => toggleVisibility('GEMINI_API_KEY')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5">
                        {visibleKeys.GEMINI_API_KEY ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                    </div>
                    
                    <div className="flex justify-between items-center mt-2">
                      <button 
                        onClick={() => verifyConnection('gemini', ['GEMINI_API_KEY'])}
                        disabled={verification.gemini.status === 'testing' || !form.GEMINI_API_KEY}
                        className="px-3 py-1 rounded-lg text-[10.5px] font-medium bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 flex items-center gap-1 transition-all"
                      >
                        {verification.gemini.status === 'testing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                        Verify Gemini
                      </button>
                      <span className="text-[10.5px] font-mono text-purple-600">
                        {verification.gemini.status === 'success' && '✓ Key Verified'}
                        {verification.gemini.status === 'error' && '✗ Verify Failed'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-black/[0.04]">
                    <label className="text-xs font-semibold block mb-1.5 text-slate-800">
                      OPENAI_API_KEY (Alternative Router)
                    </label>
                    <div className="relative">
                      <input 
                        type={visibleKeys.OPENAI_API_KEY ? "text" : "password"}
                        value={form.OPENAI_API_KEY}
                        onChange={e => setForm(prev => ({ ...prev, OPENAI_API_KEY: e.target.value }))}
                        placeholder="sk-proj-... OpenAI dashboard token" 
                        className="w-full px-3.5 py-2 pr-10 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-slate-500 transition-all font-mono"
                      />
                      <button onClick={() => toggleVisibility('OPENAI_API_KEY')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5">
                        {visibleKeys.OPENAI_API_KEY ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                    </div>

                    <div className="flex justify-between items-center mt-2">
                      <button 
                        onClick={() => verifyConnection('openai', ['OPENAI_API_KEY'])}
                        disabled={verification.openai.status === 'testing' || !form.OPENAI_API_KEY}
                        className="px-3 py-1 rounded-lg text-[10.5px] font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center gap-1 transition-all"
                      >
                        {verification.openai.status === 'testing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                        Verify OpenAI
                      </button>
                      <span className="text-[10.5px] font-mono text-slate-600">
                        {verification.openai.status === 'success' && '✓ Key Verified'}
                        {verification.openai.status === 'error' && '✗ Verify Failed'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex gap-2.5 pt-2">
                  <button 
                    onClick={() => savePillar(['GEMINI_API_KEY', 'OPENAI_API_KEY'], 'AI Orchestration')}
                    disabled={saving !== null || (!form.GEMINI_API_KEY && !form.OPENAI_API_KEY)}
                    className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}
                  >
                    {saving === 'AI Orchestration' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {saving === 'AI Orchestration' ? 'Saving Override...' : 'Save & Connect Permanently'}
                  </button>
                </div>
              </div>
            )}

            {/* PILLAR 4: EXTERNAL INTEGRATIONS */}
            {expandedPillar === 'integrations' && (
              <div className="glass rounded-3xl p-6 space-y-5 animate-slide-up">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Webhook className="w-5 h-5 text-orange-500" />
                    <div>
                      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Lead Pipeline & Workflow Tools</h2>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Configures HubSpot, Apollo, and automated Gmail notifications for complete outreach coverage.</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100">Step 4</span>
                </div>

                <div className="space-y-4 pt-2">
                  
                  {/* Gmail SMTP Segment */}
                  <div className="p-4 rounded-2xl bg-orange-500/[0.02] border border-orange-500/[0.08] space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-orange-800">
                      <Mail className="w-3.5 h-3.5" />
                      <span>Gmail SMTP Pipeline</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-gray-500 block mb-1">GMAIL_USER</label>
                        <input 
                          type="email" 
                          value={form.GMAIL_USER}
                          onChange={e => setForm(prev => ({ ...prev, GMAIL_USER: e.target.value }))}
                          placeholder="youraccount@gmail.com" 
                          className="w-full px-3.5 py-2 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-orange-500 transition-all font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 block mb-1">GMAIL_APP_PASSWORD</label>
                        <div className="relative">
                          <input 
                            type={visibleKeys.GMAIL_APP_PASSWORD ? "text" : "password"}
                            value={form.GMAIL_APP_PASSWORD}
                            onChange={e => setForm(prev => ({ ...prev, GMAIL_APP_PASSWORD: e.target.value }))}
                            placeholder="16-character google app code" 
                            className="w-full px-3.5 py-2 pr-10 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-orange-500 transition-all font-mono"
                          />
                          <button onClick={() => toggleVisibility('GMAIL_APP_PASSWORD')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5">
                            {visibleKeys.GMAIL_APP_PASSWORD ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-gray-400" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-gray-500 block mb-1">TEAM_NOTIFICATION_EMAIL</label>
                      <input 
                        type="email" 
                        value={form.TEAM_NOTIFICATION_EMAIL}
                        onChange={e => setForm(prev => ({ ...prev, TEAM_NOTIFICATION_EMAIL: e.target.value }))}
                        placeholder="recipient-notifications@yourdomain.com" 
                        className="w-full px-3.5 py-2 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-orange-500 transition-all font-mono"
                      />
                    </div>

                    <div className="flex justify-between items-center mt-1">
                      <button 
                        onClick={() => verifyConnection('gmail', ['GMAIL_USER', 'GMAIL_APP_PASSWORD'])}
                        disabled={verification.gmail.status === 'testing' || !form.GMAIL_USER}
                        className="px-2.5 py-1 rounded-lg text-[10.5px] font-medium bg-orange-50 hover:bg-orange-100 text-orange-700 flex items-center gap-1 transition-all"
                      >
                        {verification.gmail.status === 'testing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                        Test Gmail Handshake
                      </button>
                      <span className="text-[10.5px] font-mono text-orange-600">
                        {verification.gmail.status === 'success' && '✓ Connected'}
                        {verification.gmail.status === 'error' && '✗ Connection Failed'}
                      </span>
                    </div>
                  </div>

                  {/* HubSpot CRM Token */}
                  <div className="p-4 rounded-2xl bg-orange-500/[0.02] border border-orange-500/[0.08] space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-orange-800">
                      <Link2 className="w-3.5 h-3.5" />
                      <span>HubSpot Integration</span>
                    </div>

                    <div>
                      <label className="text-[11px] text-gray-500 block mb-1">HUBSPOT_PRIVATE_APP_TOKEN</label>
                      <div className="relative">
                        <input 
                          type={visibleKeys.HUBSPOT_PRIVATE_APP_TOKEN ? "text" : "password"}
                          value={form.HUBSPOT_PRIVATE_APP_TOKEN}
                          onChange={e => setForm(prev => ({ ...prev, HUBSPOT_PRIVATE_APP_TOKEN: e.target.value }))}
                          placeholder="pat-na1-xxxxxx Private App token" 
                          className="w-full px-3.5 py-2 pr-10 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-orange-500 transition-all font-mono"
                        />
                        <button onClick={() => toggleVisibility('HUBSPOT_PRIVATE_APP_TOKEN')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5">
                          {visibleKeys.HUBSPOT_PRIVATE_APP_TOKEN ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-gray-400" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-1">
                      <button 
                        onClick={() => verifyConnection('hubspot', ['HUBSPOT_PRIVATE_APP_TOKEN'])}
                        disabled={verification.hubspot.status === 'testing' || !form.HUBSPOT_PRIVATE_APP_TOKEN}
                        className="px-2.5 py-1 rounded-lg text-[10.5px] font-medium bg-orange-50 hover:bg-orange-100 text-orange-700 flex items-center gap-1 transition-all"
                      >
                        {verification.hubspot.status === 'testing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                        Verify HubSpot
                      </button>
                      <span className="text-[10.5px] font-mono text-orange-600">
                        {verification.hubspot.status === 'success' && '✓ Connected'}
                        {verification.hubspot.status === 'error' && '✗ Connection Failed'}
                      </span>
                    </div>
                  </div>

                  {/* Apollo Data Prospector Key */}
                  <div className="p-4 rounded-2xl bg-orange-500/[0.02] border border-orange-500/[0.08] space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-orange-800">
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Apollo.io Prospector Key</span>
                    </div>

                    <div>
                      <label className="text-[11px] text-gray-500 block mb-1">APOLLO_API_KEY</label>
                      <div className="relative">
                        <input 
                          type={visibleKeys.APOLLO_API_KEY ? "text" : "password"}
                          value={form.APOLLO_API_KEY}
                          onChange={e => setForm(prev => ({ ...prev, APOLLO_API_KEY: e.target.value }))}
                          placeholder="your apollo key for automated leads data enrichment" 
                          className="w-full px-3.5 py-2 pr-10 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-orange-500 transition-all font-mono"
                        />
                        <button onClick={() => toggleVisibility('APOLLO_API_KEY')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5">
                          {visibleKeys.APOLLO_API_KEY ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-gray-400" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-1">
                      <button 
                        onClick={() => verifyConnection('apollo', ['APOLLO_API_KEY'])}
                        disabled={verification.apollo.status === 'testing' || !form.APOLLO_API_KEY}
                        className="px-2.5 py-1 rounded-lg text-[10.5px] font-medium bg-orange-50 hover:bg-orange-100 text-orange-700 flex items-center gap-1 transition-all"
                      >
                        {verification.apollo.status === 'testing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                        Verify Apollo Key
                      </button>
                      <span className="text-[10.5px] font-mono text-orange-600">
                        {verification.apollo.status === 'success' && '✓ Connected'}
                        {verification.apollo.status === 'error' && '✗ Connection Failed'}
                      </span>
                    </div>
                  </div>

                </div>

                {/* Form Buttons */}
                <div className="flex gap-2.5 pt-2">
                  <button 
                    onClick={() => savePillar(['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'TEAM_NOTIFICATION_EMAIL', 'HUBSPOT_PRIVATE_APP_TOKEN', 'APOLLO_API_KEY'], 'Workflow Integrations')}
                    disabled={saving !== null || (!form.GMAIL_USER && !form.HUBSPOT_PRIVATE_APP_TOKEN && !form.APOLLO_API_KEY)}
                    className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all"
                    style={{ background: 'linear-gradient(135deg,#ea580c,#f97316)' }}
                  >
                    {saving === 'Workflow Integrations' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {saving === 'Workflow Integrations' ? 'Saving Override...' : 'Save & Connect Permanently'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* REPLICATED: .ENV.LOCAL REFERENCE BANNER */}
        <div className="glass rounded-3xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Your Active `.env.local` Overrides File</span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            This project uses standard Next.js environmental binding. When you save connections using the dashboard forms above, it permanently generates/replaces variables inside your container workspace file:
          </p>
          <pre className="text-[10.5px] leading-relaxed p-4 rounded-2xl overflow-x-auto"
            style={{ background: 'rgba(0,0,0,0.03)', color: 'var(--text-secondary)', fontFamily: 'monospace', border: '1px solid rgba(0,0,0,0.05)' }}>
{`# Supabase Database
NEXT_PUBLIC_SUPABASE_URL="${form.NEXT_PUBLIC_SUPABASE_URL || 'https://your-domain.supabase.co'}"
SUPABASE_SERVICE_ROLE_KEY="${form.SUPABASE_SERVICE_ROLE_KEY ? '••••••••' : ''}"

# Messenger
WHATSAPP_PHONE_NUMBER_ID="${form.WHATSAPP_PHONE_NUMBER_ID || ''}"
WHATSAPP_API_TOKEN="${form.WHATSAPP_API_TOKEN ? '••••••••' : ''}"

# AI Brain
GEMINI_API_KEY="${form.GEMINI_API_KEY ? '••••••••' : ''}"
OPENAI_API_KEY="${form.OPENAI_API_KEY ? '••••••••' : ''}"

# Pipelines
GMAIL_USER="${form.GMAIL_USER || ''}"
GMAIL_APP_PASSWORD="${form.GMAIL_APP_PASSWORD ? '••••••••' : ''}"
APOLLO_API_KEY="${form.APOLLO_API_KEY ? '••••••••' : ''}"
HUBSPOT_PRIVATE_APP_TOKEN="${form.HUBSPOT_PRIVATE_APP_TOKEN ? '••••••••' : ''}"`}
          </pre>
        </div>

      </div>
    </div>
  )
}
