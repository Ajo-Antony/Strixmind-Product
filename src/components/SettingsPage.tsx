'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Settings, Webhook, Brain, MessageSquare, Database, CheckCircle2, 
  XCircle, AlertCircle, Loader2, Copy, Shield, RefreshCw, 
  Activity, ArrowRight, Sparkles, Mail, Link2, HelpCircle, Eye, EyeOff,
  Terminal, Search, Trash2, Filter, AlertTriangle, ChevronRight, ChevronDown, Check
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Log Interface ───────────────────────────────────────────────────────────
interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'success'
  category: 'webhook' | 'automation' | 'ai' | 'database' | 'general'
  message: string
  details?: string
}

// ─── Utility Components ──────────────────────────────────────────────────────
function CopyField({ label, value, masked }: { label: string; value: string; masked?: boolean }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success('Copied to clipboard!')
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
  
  // Guided step onboard state (1: database, 2: whatsapp, 3: ai, 4: integrations, 5: completed)
  const [onboardingStep, setOnboardingStep] = useState(1)
  const [highlightPillar, setHighlightPillar] = useState<string | null>(null)

  // Real-time log panel state
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(false)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

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
        // Hydrate default process.env credentials from server
        let finalConnections = { ...data.connections }

        // Persistent Fallback: Attempt client-side hydration from localStorage for Vercel
        try {
          const localStr = localStorage.getItem('strixmind_connections')
          if (localStr) {
            const localData = JSON.parse(localStr)
            Object.keys(localData).forEach(key => {
              if (localData[key] && (!finalConnections[key] || finalConnections[key].includes('••••'))) {
                finalConnections[key] = localData[key]
              }
            })
          }
        } catch (e) {
          console.warn('[LocalStorage] Could not load backup configurations:', e)
        }

        setForm(prev => ({
          ...prev,
          ...finalConnections
        }))
        
        // Auto-detect connection state based on backend response & localStorage backups
        const rawKeys: string[] = data.rawConfiguredKeys || []
        
        // Let's check local storage backup keys too
        const localBackup = typeof window !== 'undefined' ? localStorage.getItem('strixmind_connections') : null
        const localKeys = localBackup ? Object.keys(JSON.parse(localBackup)) : []
        const activeKeys = Array.from(new Set([...rawKeys, ...localKeys]))

        setVerification(prev => ({
          ...prev,
          supabase: {
            status: (activeKeys.includes('NEXT_PUBLIC_SUPABASE_URL') && activeKeys.includes('SUPABASE_SERVICE_ROLE_KEY')) ? 'success' : 'idle',
            latency: null,
            error: null
          },
          whatsapp: {
            status: (activeKeys.includes('WHATSAPP_API_TOKEN') && activeKeys.includes('WHATSAPP_PHONE_NUMBER_ID')) ? 'success' : 'idle',
            latency: null,
            error: null
          },
          gemini: {
            status: activeKeys.includes('GEMINI_API_KEY') ? 'success' : 'idle',
            latency: null,
            error: null
          },
          openai: {
            status: activeKeys.includes('OPENAI_API_KEY') ? 'success' : 'idle',
            latency: null,
            error: null
          },
          gmail: {
            status: (activeKeys.includes('GMAIL_USER') && activeKeys.includes('GMAIL_APP_PASSWORD')) ? 'success' : 'idle',
            latency: null,
            error: null
          },
          hubspot: {
            status: activeKeys.includes('HUBSPOT_PRIVATE_APP_TOKEN') ? 'success' : 'idle',
            latency: null,
            error: null
          },
          apollo: {
            status: activeKeys.includes('APOLLO_API_KEY') ? 'success' : 'idle',
            latency: null,
            error: null
          }
        }))

        // Auto-calculate onboarding step based on active connections
        let startStep = 1
        if (activeKeys.includes('NEXT_PUBLIC_SUPABASE_URL') && activeKeys.includes('SUPABASE_SERVICE_ROLE_KEY')) {
          startStep = 2
          if (activeKeys.includes('WHATSAPP_API_TOKEN') && activeKeys.includes('WHATSAPP_PHONE_NUMBER_ID')) {
            startStep = 3
            if (activeKeys.includes('GEMINI_API_KEY') || activeKeys.includes('OPENAI_API_KEY')) {
              startStep = 4
              if (activeKeys.includes('GMAIL_USER') || activeKeys.includes('HUBSPOT_PRIVATE_APP_TOKEN') || activeKeys.includes('APOLLO_API_KEY')) {
                startStep = 5
              }
            }
          }
        }
        
        const savedStep = localStorage.getItem('strixmind_onboarding_step')
        if (savedStep) {
          setOnboardingStep(Math.max(startStep, parseInt(savedStep, 10)))
        } else {
          setOnboardingStep(startStep)
        }

      }
    } catch (err: any) {
      toast.error('Failed to load credentials: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch real-time logs from server
  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLogLoading(true)
    try {
      const res = await fetch('/api/logs')
      const data = await res.json()
      if (data.success) {
        setLogs(data.logs || [])
      }
    } catch (e) {
      console.error('[Logs] Fetching log stream failed:', e)
    } finally {
      if (!silent) setLogLoading(false)
    }
  }, [])

  // Initial loads and auto polling for live logs
  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  useEffect(() => {
    fetchLogs()
    let logInterval: NodeJS.Timeout
    if (autoRefreshLogs) {
      logInterval = setInterval(() => {
        fetchLogs(true)
      }, 3000)
    }
    return () => {
      if (logInterval) clearInterval(logInterval)
    }
  }, [autoRefreshLogs, fetchLogs])

  // Save parameters permanently (Local Dev + Browser Sync fallback for Vercel)
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
        // Save copy to local storage to ensure persistent load easily on Vercel
        try {
          const localStr = localStorage.getItem('strixmind_connections')
          const localData = localStr ? JSON.parse(localStr) : {}
          pillarKeys.forEach(key => {
            if (form[key] && !form[key].includes('••••')) {
              localData[key] = form[key]
            }
          })
          localStorage.setItem('strixmind_connections', JSON.stringify(localData))
        } catch (e) {
          console.error('[LocalStorage] Backup sync failed:', e)
        }

        toast.success(`${label} configurations saved successfully!`)
        fetchConnections()
        fetchLogs()
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
    // Fill up testing state
    setVerification(prev => ({
      ...prev,
      [type]: { status: 'testing', latency: null, error: null }
    }))

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
        fetchLogs()

        // ── Auto-Advance Onboarding Steps walk-through ─────────────────────
        if (type === 'supabase') {
          setOnboardingStep(2)
          localStorage.setItem('strixmind_onboarding_step', '2')
          setTimeout(() => {
            setExpandedPillar('whatsapp')
            setHighlightPillar('whatsapp')
            toast.info('Step 1 complete! Automatically moving to Step 2: WhatsApp Setup.')
          }, 1200)
        } else if (type === 'whatsapp') {
          setOnboardingStep(3)
          localStorage.setItem('strixmind_onboarding_step', '3')
          setTimeout(() => {
            setExpandedPillar('ai')
            setHighlightPillar('ai')
            toast.info('Step 2 complete! Automatically moving to Step 3: AI Engine Config.')
          }, 1200)
        } else if (type === 'gemini' || type === 'openai') {
          setOnboardingStep(4)
          localStorage.setItem('strixmind_onboarding_step', '4')
          setTimeout(() => {
            setExpandedPillar('integrations')
            setHighlightPillar('integrations')
            toast.info('Step 3 complete! Automatically moving to Step 4: Pipeline CRM Integrations.')
          }, 1200)
        } else {
          setOnboardingStep(5)
          localStorage.setItem('strixmind_onboarding_step', '5')
          toast.success('Workspace fully verified and ready for production deployment!')
        }
      } else {
        setVerification(prev => ({
          ...prev,
          [type]: { status: 'error', latency: data.latencyMs || null, error: data.error }
        }))
        toast.error(`${type.toUpperCase()} Verification Failed: ${data.error}`)
        fetchLogs()
      }
    } catch (err: any) {
      setVerification(prev => ({
        ...prev,
        [type]: { status: 'error', latency: null, error: err.message }
      }))
      toast.error(err.message)
      fetchLogs()
    }
  }

  // Clear server & memory logs
  const handleClearLogs = async () => {
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Log stream history successfully cleared!')
        fetchLogs()
      }
    } catch (err: any) {
      toast.error('Failed to clear logs: ' + err.message)
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
        fetchLogs()
      } else {
        const data = await res.json()
        setTestMsgResult({ ok: false, message: data.error ?? 'Failed to deliver message' })
        toast.error(data.error ?? 'Connection failed')
        fetchLogs()
      }
    } catch (err: any) {
      setTestMsgResult({ ok: false, message: err.message })
      toast.error(err.message)
      fetchLogs()
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

  // Filter and Search logs
  const filteredLogs = logs.filter(log => {
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter
    const matchesLevel = levelFilter === 'all' || log.level === logLevelFilter
    const matchesSearch = searchQuery === '' || 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesCategory && matchesLevel && matchesSearch
  })

  // Normalize level state for matching
  const logLevelFilter = levelFilter

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* ─── ONBOARDING WIZARD BANNER ─── */}
      <div className="glass rounded-3xl p-6 relative overflow-hidden" style={{ border: '1px solid rgba(16,185,129,0.2)', background: 'linear-gradient(135deg, rgba(240,253,244,0.3) 0%, rgba(255,255,255,0.7) 100%)' }}>
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Dynamic Interactive Onboarding Walkthrough</span>
            </div>
            
            {onboardingStep === 1 && (
              <>
                <h1 className="text-lg font-bold text-slate-900 font-sans tracking-tight">Step 1: Establishing Persistent Database (Supabase)</h1>
                <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                  First, we need secure persistent storage. Setup your Supabase URL and Service Role Key to save CRM records, workflows, and log histories securely on Vercel or locally.
                </p>
              </>
            )}
            {onboardingStep === 2 && (
              <>
                <h1 className="text-lg font-bold text-slate-900 font-sans tracking-tight">Step 2: Connecting Meta WhatsApp Business API</h1>
                <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                  Database established! Now connect WhatsApp by saving your Phone Number ID and Access Token. This activates real-time conversation flows and log archiving.
                </p>
              </>
            )}
            {onboardingStep === 3 && (
              <>
                <h1 className="text-lg font-bold text-slate-900 font-sans tracking-tight">Step 3: Initializing AI Orchestration Engine</h1>
                <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                  Almost there! Setup your Google Gemini API key (or alternative OpenAI key) to empower active automations with context-aware responses and intelligent lead qualification.
                </p>
              </>
            )}
            {onboardingStep === 4 && (
              <>
                <h1 className="text-lg font-bold text-slate-900 font-sans tracking-tight">Step 4: Activating Workflow Pipeline Integrations</h1>
                <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                  Perfect! For the final step, set up Apollo, HubSpot CRM, or your Gmail SMTP notifier parameters to dispatch emails and update client CRM pipelines automatically.
                </p>
              </>
            )}
            {onboardingStep >= 5 && (
              <>
                <h1 className="text-lg font-bold text-emerald-800 font-sans tracking-tight flex items-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Step 5: Onboarding Fully Completed!
                </h1>
                <p className="text-xs text-emerald-700 leading-relaxed max-w-3xl">
                  Your workspace is 100% configured with client-side localStorage backups and server-side environment overrides. You can upload this configuration to Vercel confidently!
                </p>
              </>
            )}
          </div>

          <div className="flex-shrink-0">
            {onboardingStep === 1 && (
              <button 
                onClick={() => {
                  setExpandedPillar('database')
                  setHighlightPillar('database')
                  toast.success('Navigated to Database Settings. Fill out the fields and hit "Test Handshake"!')
                }}
                className="px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center gap-1.5 transition-all"
              >
                <span>Click Here: Configure Database</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onboardingStep === 2 && (
              <button 
                onClick={() => {
                  setExpandedPillar('whatsapp')
                  setHighlightPillar('whatsapp')
                  toast.success('Navigated to WhatsApp Settings. Enter your token and Phone ID to handshake!')
                }}
                className="px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm flex items-center gap-1.5 transition-all"
              >
                <span>Click Here: Configure WhatsApp</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onboardingStep === 3 && (
              <button 
                onClick={() => {
                  setExpandedPillar('ai')
                  setHighlightPillar('ai')
                  toast.success('Navigated to AI Orchestrator Settings. Connect your Gemini API Key!')
                }}
                className="px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-sm flex items-center gap-1.5 transition-all"
              >
                <span>Click Here: Configure AI Brain</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onboardingStep === 4 && (
              <button 
                onClick={() => {
                  setExpandedPillar('integrations')
                  setHighlightPillar('integrations')
                  toast.success('Navigated to Outbound Integrations settings!')
                }}
                className="px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 shadow-sm flex items-center gap-1.5 transition-all"
              >
                <span>Click Here: Configure Integrations</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onboardingStep >= 5 && (
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    localStorage.setItem('strixmind_onboarding_step', '1')
                    setOnboardingStep(1)
                    setExpandedPillar('database')
                    toast.success('Onboarding steps reset. Starting guide over!')
                  }}
                  className="px-4 py-2.5 rounded-2xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all border border-slate-200"
                >
                  Restart Guide
                </button>
                <div className="px-5 py-2.5 rounded-2xl text-xs font-bold text-emerald-800 bg-emerald-100 flex items-center gap-1.5 border border-emerald-200">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Setup Ready
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
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
              const isStepOnboarding = onboardingStep === idx + 1
              const shouldPulse = isStepOnboarding && highlightPillar === step.id

              return (
                <button 
                  key={step.id}
                  onClick={() => {
                    setExpandedPillar(step.id)
                    setHighlightPillar(null)
                  }}
                  className={`w-full flex items-start gap-3 p-3 rounded-2xl text-left transition-all duration-200 ${
                    shouldPulse ? 'ring-2 ring-emerald-500 animate-pulse' : ''
                  }`}
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
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Durable Cloud Encryption</span>
              <p className="text-[10.5px] mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                All sensitive variables write directly to server environment mounts. If running on read-only serverless hosts like Vercel, configurations synchronize safely inside browser-side <code className="font-mono text-emerald-800">localStorage</code> for simple self-healing connections on refresh.
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
                      {saving === 'Supabase Database' ? 'Saving Override...' : 'Save & Sync Settings'}
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
                      {saving === 'WhatsApp CRM' ? 'Saving Override...' : 'Save & Sync Settings'}
                    </button>
                  </div>

                  {/* Additional manual test message */}
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
                          Verify Gemini Key
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
                          Verify OpenAI Key
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
                      {saving === 'AI Orchestration' ? 'Saving Override...' : 'Save & Sync Settings'}
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
                          Test Gmail SMTP Handshake
                        </button>
                        <span className="text-[10.5px] font-mono text-orange-600">
                          {verification.gmail.status === 'success' && '✓ SMTP verified'}
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
                          Verify HubSpot Token
                        </button>
                        <span className="text-[10.5px] font-mono text-orange-600">
                          {verification.hubspot.status === 'success' && '✓ HubSpot Verified'}
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
                          {verification.apollo.status === 'success' && '✓ Apollo Verified'}
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
                      {saving === 'Workflow Integrations' ? 'Saving Override...' : 'Save & Sync Settings'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* .ENV.LOCAL REFERENCE BANNER */}
          <div className="glass rounded-3xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Active Workspace Overrides</span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Variables write directly into your server containers at runtime and backup inside browser secure memories to prevent setup failures during Vercel serverless redeployments:
            </p>
            <pre className="text-[10.5px] leading-relaxed p-4 rounded-2xl overflow-x-auto"
              style={{ background: 'rgba(0,0,0,0.03)', color: 'var(--text-secondary)', fontFamily: 'monospace', border: '1px solid rgba(0,0,0,0.05)' }}>
{`# Supabase Database (Step 1)
NEXT_PUBLIC_SUPABASE_URL="${form.NEXT_PUBLIC_SUPABASE_URL || 'https://your-domain.supabase.co'}"
SUPABASE_SERVICE_ROLE_KEY="${form.SUPABASE_SERVICE_ROLE_KEY ? '••••••••' : ''}"

# Meta Messenger (Step 2)
WHATSAPP_PHONE_NUMBER_ID="${form.WHATSAPP_PHONE_NUMBER_ID || ''}"
WHATSAPP_API_TOKEN="${form.WHATSAPP_API_TOKEN ? '••••••••' : ''}"

# AI Brain Orchestrator (Step 3)
GEMINI_API_KEY="${form.GEMINI_API_KEY ? '••••••••' : ''}"
OPENAI_API_KEY="${form.OPENAI_API_KEY ? '••••••••' : ''}"

# Pipeline Syncs (Step 4)
GMAIL_USER="${form.GMAIL_USER || ''}"
GMAIL_APP_PASSWORD="${form.GMAIL_APP_PASSWORD ? '••••••••' : ''}"
APOLLO_API_KEY="${form.APOLLO_API_KEY ? '••••••••' : ''}"
HUBSPOT_PRIVATE_APP_TOKEN="${form.HUBSPOT_PRIVATE_APP_TOKEN ? '••••••••' : ''}"`}
            </pre>
          </div>

        </div>
      </div>

      {/* ─── LIVE WHATSAPP AUTOMATION LOG PANEL ─── */}
      <div id="log-panel" className="glass rounded-3xl p-6 space-y-4 border border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 rounded-2xl text-emerald-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                WhatsApp Automation Log Panel
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              </h2>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Identify Meta API errors, webhook triggers, database queries, and AI orchestrator decisions.</p>
            </div>
          </div>

          {/* Log Controls */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search error messages or details..."
                className="w-full md:w-64 pl-9 pr-3 py-1.5 rounded-xl text-xs bg-black/5 outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
              />
            </div>
            
            <button 
              onClick={() => fetchLogs(false)}
              disabled={logLoading}
              title="Refresh Logs"
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${logLoading ? 'animate-spin text-emerald-500' : ''}`} />
            </button>

            <button 
              onClick={handleClearLogs}
              title="Clear Log Stream"
              className="p-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 transition-colors flex items-center gap-1 text-xs font-semibold px-3"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Streams</span>
            </button>

            <label className="flex items-center gap-1.5 text-xs font-semibold select-none ml-1">
              <input 
                type="checkbox" 
                checked={autoRefreshLogs}
                onChange={e => setAutoRefreshLogs(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
              />
              <span className="text-[10.5px] text-slate-500">Auto Poll</span>
            </label>
          </div>
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-1 text-slate-500 font-semibold mr-1.5">
            <Filter className="w-3 h-3 text-slate-400" />
            <span>Filters:</span>
          </div>
          
          {/* Categories */}
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] text-slate-400 font-semibold mr-1 self-center">Category:</span>
            {['all', 'webhook', 'automation', 'ai', 'database', 'general'].map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                  categoryFilter === cat 
                    ? 'bg-slate-900 text-white border-slate-900' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-200 mx-2 hidden md:block" />

          {/* Severity Levels */}
          <div className="flex flex-wrap gap-1 mt-1 md:mt-0">
            <span className="text-[10px] text-slate-400 font-semibold mr-1 self-center">Severity:</span>
            {['all', 'info', 'success', 'warn', 'error'].map(lvl => {
              let activeColors = 'bg-slate-900 text-white border-slate-900'
              if (lvl === 'success') activeColors = 'bg-emerald-600 text-white border-emerald-600'
              if (lvl === 'warn') activeColors = 'bg-amber-600 text-white border-amber-600'
              if (lvl === 'error') activeColors = 'bg-rose-600 text-white border-rose-600'

              return (
                <button
                  key={lvl}
                  onClick={() => setLevelFilter(lvl)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                    levelFilter === lvl 
                      ? activeColors
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {lvl}
                </button>
              )
            })}
          </div>
        </div>

        {/* Logs Terminal Area */}
        <div className="bg-slate-950 text-slate-100 rounded-2xl overflow-hidden border border-slate-900 shadow-inner font-mono text-xs">
          
          <div className="bg-slate-900 px-4 py-2 text-[10px] text-slate-400 border-b border-slate-950 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="h-2 w-2 rounded-full bg-yellow-500" />
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="ml-1.5 font-bold tracking-tight text-slate-300">STRIXMIND AUTOMATION STACK CONSOLE</span>
            </div>
            <div>
              Showing {filteredLogs.length} of {logs.length} logged entries
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-900 p-2 space-y-1">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                <Terminal className="w-8 h-8 text-slate-600" />
                <span>No console logs match your selected filter requirements.</span>
              </div>
            ) : (
              filteredLogs.map(log => {
                let lvlColor = 'text-slate-400'
                let lvlBg = 'bg-slate-800/60'
                if (log.level === 'success') { lvlColor = 'text-emerald-400'; lvlBg = 'bg-emerald-950/40 border border-emerald-900/30' }
                if (log.level === 'warn') { lvlColor = 'text-amber-400'; lvlBg = 'bg-amber-950/40 border border-amber-900/30' }
                if (log.level === 'error') { lvlColor = 'text-rose-400'; lvlBg = 'bg-rose-950/40 border border-rose-900/30' }

                let catColor = 'bg-slate-800 text-slate-300'
                if (log.category === 'webhook') catColor = 'bg-emerald-900/50 text-emerald-300'
                if (log.category === 'automation') catColor = 'bg-orange-900/50 text-orange-300'
                if (log.category === 'ai') catColor = 'bg-purple-900/50 text-purple-300'
                if (log.category === 'database') catColor = 'bg-blue-900/50 text-blue-300'

                const isExpanded = expandedLogId === log.id

                return (
                  <div key={log.id} className={`p-2.5 rounded-lg transition-all ${lvlBg}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 cursor-pointer select-none"
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}>
                      
                      <div className="flex items-start sm:items-center gap-2 min-w-0">
                        {/* Level badge */}
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${lvlColor} bg-black/30 flex-shrink-0`}>
                          {log.level}
                        </span>

                        {/* Category badge */}
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wider ${catColor} flex-shrink-0`}>
                          {log.category}
                        </span>

                        {/* Log Text */}
                        <span className="text-slate-100 truncate text-[11px] font-medium">
                          {log.message}
                        </span>
                      </div>

                      {/* Timestamp and expander arrow */}
                      <div className="flex items-center gap-2 self-end sm:self-auto text-[10px] text-slate-400">
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        {log.details && (
                          <span className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors">
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Detailed expandable code block */}
                    {isExpanded && log.details && (
                      <div className="mt-2.5 pt-2 border-t border-slate-900/50 text-[10px] leading-relaxed relative">
                        <pre className="p-3 rounded-lg bg-slate-950 border border-slate-900 overflow-x-auto text-slate-300 whitespace-pre-wrap font-mono">
                          {log.details}
                        </pre>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(log.details!)
                            toast.success('Log details copied!')
                          }}
                          className="absolute right-3 top-5 px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded text-[9px] font-bold border border-slate-800"
                        >
                          Copy Stack
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
