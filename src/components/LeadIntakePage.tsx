'use client'
import { useState, useEffect } from 'react'
import {
  Webhook, Copy, CheckCircle, AlertCircle, Loader2,
  Mail, Zap, Database, RefreshCw, ExternalLink,
  ChevronRight, Globe, Users, Activity
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────
interface IntakeLog {
  id: string
  full_name: string
  email: string
  phone: string
  source: string
  status: string
  thank_you_sent: boolean
  team_notified: boolean
  apollo_enriched: boolean
  hubspot_id: string | null
  created_at: string
  lead?: { name: string; ai_score: number; stage: string }
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); toast.success('Copied!'); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{ background: 'rgba(34,197,94,0.08)', color: '#166534' }}
    >
      {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

function PipelineBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{
        background: ok ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)',
        color:      ok ? '#16a34a'              : '#64748b',
      }}>
      {ok ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
      {label}
    </span>
  )
}

const STAGE_COLOR: Record<string, string> = {
  new:          '#64748b',
  contacted:    '#3b82f6',
  qualified:    '#8b5cf6',
  scheduled:    '#f59e0b',
  negotiation:  '#f97316',
  converted:    '#22c55e',
  closed:       '#ef4444',
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LeadIntakePage() {
  const [logs, setLogs]         = useState<IntakeLog[]>([])
  const [loading, setLoading]   = useState(false)
  const [testing, setTesting]   = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [activeTab, setActiveTab]   = useState<'setup' | 'log' | 'test'>('setup')

  const [testForm, setTestForm] = useState({
    first_name: 'Priya',
    last_name: 'Sharma',
    email: '',
    phone: '',
    company: 'Sharma Boutique',
    message: 'Interested in AI automation for my business',
    source: 'website_test',
  })

  const intakeUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/lead-intake`
    : 'https://yourdomain.com/api/lead-intake'

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/lead-intake/log?limit=20')
      const data = await res.json()
      setLogs(data.data ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { if (activeTab === 'log') fetchLogs() }, [activeTab])

  const sendTest = async () => {
    if (!testForm.first_name || (!testForm.email && !testForm.phone)) {
      return toast.error('first_name and email or phone required')
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/lead-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testForm),
      })
      const data = await res.json()
      setTestResult({ ok: res.ok, ...data })
      if (res.ok) toast.success('Intake pipeline triggered successfully!')
      else toast.error(data.error ?? 'Pipeline failed')
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message })
      toast.error(err.message)
    } finally {
      setTesting(false)
    }
  }

  const tabs = [
    { id: 'setup', label: 'Setup', icon: Webhook },
    { id: 'test',  label: 'Test',  icon: Zap },
    { id: 'log',   label: 'Activity', icon: Activity },
  ] as const

  return (
    <div className="max-w-3xl space-y-5">

      {/* Header */}
      <div className="glass rounded-3xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Webhook className="w-5 h-5" style={{ color: '#8b5cf6' }} />
              <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Lead Intake Pipeline</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Website form → StrixMind → parallel fan-out to Gmail + Apollo enrichment → HubSpot CRM
            </p>
          </div>
        </div>

        {/* Pipeline diagram */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {[
            { label: 'Website Form', color: '#8b5cf6', icon: Globe },
            { label: '→', color: '#94a3b8', icon: null },
            { label: 'Lead Created', color: '#3b82f6', icon: Users },
            { label: '→', color: '#94a3b8', icon: null },
            { label: 'Gmail Thank You', color: '#22c55e', icon: Mail },
            { label: '+', color: '#94a3b8', icon: null },
            { label: 'Team Alert', color: '#22c55e', icon: Mail },
            { label: '+', color: '#94a3b8', icon: null },
            { label: 'Apollo Enrich', color: '#f59e0b', icon: Zap },
            { label: '→', color: '#94a3b8', icon: null },
            { label: 'HubSpot CRM', color: '#f97316', icon: Database },
          ].map((item, i) =>
            item.icon ? (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
                style={{ background: `${item.color}12`, color: item.color, border: `1px solid ${item.color}25` }}>
                <item.icon className="w-3 h-3" />
                {item.label}
              </span>
            ) : (
              <span key={i} className="text-xs font-bold" style={{ color: item.color }}>{item.label}</span>
            )
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: 'rgba(0,0,0,0.04)' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all"
            style={activeTab === tab.id
              ? { background: 'white', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
              : { color: 'var(--text-muted)' }}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Setup Tab ── */}
      {activeTab === 'setup' && (
        <div className="space-y-4">

          {/* Webhook URL */}
          <div className="glass rounded-3xl p-5">
            <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Your Webhook URL</div>
            <div className="flex items-center gap-2 p-3 rounded-xl font-mono text-xs break-all"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-secondary)' }}>
              <span className="flex-1">{intakeUrl}</span>
              <CopyButton value={intakeUrl} label="Copy" />
            </div>
            <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
              Point your website contact form's action to this URL with method <code className="bg-black/5 px-1 rounded">POST</code> and <code className="bg-black/5 px-1 rounded">Content-Type: application/json</code>
            </p>
          </div>

          {/* Required env vars */}
          <div className="glass rounded-3xl p-5">
            <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Required Environment Variables</div>
            <div className="space-y-2">
              {[
                { key: 'GMAIL_USER',                  desc: 'Your Gmail address (e.g. you@gmail.com)',            required: true  },
                { key: 'GMAIL_APP_PASSWORD',           desc: 'Gmail App Password (not your login password)',       required: true  },
                { key: 'TEAM_NOTIFICATION_EMAIL',      desc: 'Where to send internal new-lead alerts',             required: true  },
                { key: 'APOLLO_API_KEY',               desc: 'Apollo.io API key for contact enrichment',           required: false },
                { key: 'HUBSPOT_PRIVATE_APP_TOKEN',    desc: 'HubSpot Private App token for contact creation',     required: false },
              ].map(v => (
                <div key={v.key} className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: v.required ? 'rgba(239,68,68,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${v.required ? 'rgba(239,68,68,0.1)' : 'rgba(0,0,0,0.06)'}` }}>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0 ${v.required ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400'}`}>
                    {v.required ? 'REQ' : 'OPT'}
                  </span>
                  <div>
                    <code className="text-xs font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{v.key}</code>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{v.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Expected payload */}
          <div className="glass rounded-3xl p-5">
            <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Expected Payload</div>
            <pre className="text-[11px] p-4 rounded-xl overflow-x-auto"
              style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)', fontFamily: 'monospace', lineHeight: 1.6 }}>
{`POST /api/lead-intake
Content-Type: application/json

{
  "first_name": "Priya",          // required
  "last_name":  "Sharma",         // optional
  "email":      "priya@ex.com",   // required if no phone
  "phone":      "+919876543210",  // required if no email
  "company":    "Sharma Boutique",// optional
  "message":    "Interested in…", // optional
  "source":     "website"         // optional (default: "website")
}`}
            </pre>
            <div className="mt-3 flex gap-2 flex-wrap">
              <CopyButton value={`fetch('${intakeUrl}', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({\n    first_name: 'Priya',\n    email: 'priya@example.com',\n    phone: '+919876543210',\n    source: 'website'\n  })\n})`} label="Copy fetch snippet" />
            </div>
          </div>

          {/* SQL migration */}
          <div className="glass rounded-3xl p-5">
            <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Supabase Migration</div>
            <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>
              Run this once in your Supabase SQL Editor to create the intake activity log table.
            </p>
            <div className="flex items-center gap-2">
              <CopyButton value={`-- Run in Supabase SQL Editor\ncreate table if not exists lead_intake_log (\n  id              uuid primary key default gen_random_uuid(),\n  lead_id         uuid references leads(id) on delete cascade,\n  email           text,\n  phone           text,\n  full_name       text,\n  source          text default 'website',\n  raw_payload     jsonb,\n  status          text default 'received',\n  thank_you_sent  boolean default false,\n  team_notified   boolean default false,\n  apollo_enriched boolean default false,\n  hubspot_id      text,\n  processed_at    timestamptz,\n  created_at      timestamptz default now()\n);\nalter table lead_intake_log enable row level security;\ncreate policy "service_role_all" on lead_intake_log for all using (auth.role() = 'service_role');`} label="Copy SQL" />
              <a href="https://app.supabase.com" target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(59,130,246,0.08)', color: '#2563eb' }}>
                <ExternalLink className="w-3 h-3" /> Open Supabase
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Test Tab ── */}
      {activeTab === 'test' && (
        <div className="glass rounded-3xl p-5 space-y-4">
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Fire a Test Lead</div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            This creates a real lead in StrixMind, sends emails (if configured), enriches via Apollo, and creates a HubSpot contact.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'first_name', label: 'First Name', placeholder: 'Priya',  required: true },
              { key: 'last_name',  label: 'Last Name',  placeholder: 'Sharma', required: false },
              { key: 'email',      label: 'Email',      placeholder: 'priya@example.com', required: false },
              { key: 'phone',      label: 'Phone',      placeholder: '+919876543210',      required: false },
              { key: 'company',    label: 'Company',    placeholder: 'Sharma Boutique',    required: false },
              { key: 'source',     label: 'Source',     placeholder: 'website',            required: false },
            ].map(f => (
              <div key={f.key} className={f.key === 'email' || f.key === 'phone' ? '' : ''}>
                <label className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                  {f.label} {f.required && <span style={{ color: '#ef4444' }}>*</span>}
                </label>
                <input
                  value={(testForm as any)[f.key]}
                  onChange={e => setTestForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                  style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }}
                />
              </div>
            ))}
          </div>

          <div>
            <label className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Message</label>
            <textarea
              value={testForm.message}
              onChange={e => setTestForm(p => ({ ...p, message: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-xl text-xs outline-none resize-none"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }}
            />
          </div>

          <button onClick={sendTest} disabled={testing}
            className="w-full py-2.5 rounded-xl text-sm text-white font-medium flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#6d28d9,#8b5cf6)', opacity: testing ? 0.7 : 1 }}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {testing ? 'Running pipeline…' : 'Send Test Lead'}
          </button>

          {testResult && (
            <div className="rounded-2xl p-4 space-y-3"
              style={{ background: testResult.ok ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${testResult.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: testResult.ok ? '#166534' : '#dc2626' }}>
                {testResult.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {testResult.ok ? 'Pipeline completed' : `Error: ${testResult.error}`}
              </div>
              {testResult.ok && testResult.pipeline && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Pipeline Results</div>
                  <div className="flex flex-wrap gap-2">
                    <PipelineBadge ok={testResult.pipeline.thank_you_email === 'sent'} label={`Thank you email: ${testResult.pipeline.thank_you_email}`} />
                    <PipelineBadge ok={testResult.pipeline.team_notify === 'sent'}     label={`Team alert: ${testResult.pipeline.team_notify}`} />
                    <PipelineBadge ok={testResult.pipeline.apollo_enriched}            label={`Apollo: ${testResult.pipeline.apollo_enriched ? 'enriched' : 'skipped'}`} />
                    <PipelineBadge ok={testResult.pipeline.hubspot?.includes('created')} label={`HubSpot: ${testResult.pipeline.hubspot}`} />
                  </div>
                  {testResult.lead_id && (
                    <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                      Lead ID: <code className="font-mono">{testResult.lead_id}</code>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Activity Log Tab ── */}
      {activeTab === 'log' && (
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Intake Activity</div>
            <button onClick={fetchLogs} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)' }}>
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Refresh
            </button>
          </div>

          {loading && <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}><Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />Loading…</div>}

          {!loading && logs.length === 0 && (
            <div className="py-10 text-center">
              <Activity className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No intake events yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>Run the Supabase migration, then test the pipeline above</p>
            </div>
          )}

          {!loading && logs.length > 0 && (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="p-3 rounded-2xl" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)' }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{log.full_name}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {log.email || log.phone} · {log.source} · {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                    {log.lead && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${STAGE_COLOR[log.lead.stage] ?? '#64748b'}15`, color: STAGE_COLOR[log.lead.stage] ?? '#64748b' }}>
                          {log.lead.stage}
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: '#8b5cf6' }}>
                          {log.lead.ai_score}/100
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <PipelineBadge ok={log.thank_you_sent}  label="Thank you" />
                    <PipelineBadge ok={log.team_notified}   label="Team alert" />
                    <PipelineBadge ok={log.apollo_enriched} label="Apollo" />
                    <PipelineBadge ok={!!log.hubspot_id}    label={log.hubspot_id ? `HubSpot ${log.hubspot_id.slice(0, 8)}` : 'HubSpot'} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
