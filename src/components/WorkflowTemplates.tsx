'use client'
import { useState } from 'react'
import {
  Download, Upload, CheckCircle2, AlertCircle, X, Zap, Users,
  MessageSquare, Clock, Brain, GitBranch, Calendar, Search,
  ChevronRight, Loader2, FileCode2, Eye, Play, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

// ─── Built-in template catalogue ──────────────────────────────────────────────

const TEMPLATES = [
  {
    id: 'customer-onboarding',
    name: 'Customer Onboarding Sequence',
    description: 'Auto-welcome new leads with timed follow-up messages, onboarding docs, and a personal check-in after Day 1.',
    category: 'Onboarding',
    icon: '🎉',
    color: '#22c55e',
    tags: ['welcome', 'email', 'crm', 'multi-step'],
    steps_count: 7,
    estimated_time: '7 days',
    popular: true,
    workflow: {
      name: 'Customer Onboarding Sequence',
      description: 'Auto-welcome new customers with timed messages, docs and check-ins',
      trigger_type: 'inbound_message',
      trigger_config: { keyword: '' },
      steps: [
        { type: 'update_lead', config: { stage: 'qualified' } },
        { type: 'notify', config: { message: '🎉 New customer: {{lead.name}} just signed up! Score: {{lead.ai_score}}' } },
        { type: 'send_whatsapp', config: { message: `Hi {{lead.name}}! 🎉 Welcome aboard! We're so excited to have you. Your journey starts now — reply with any questions anytime.` } },
        { type: 'wait', config: { duration: 2, unit: 'hours' } },
        { type: 'send_whatsapp', config: { message: `Hi {{lead.name}}! 📋 Your onboarding resources are ready. Check your email for documents, guides, and next steps. Let us know if you need anything!` } },
        { type: 'wait', config: { duration: 1, unit: 'days' } },
        { type: 'send_whatsapp', config: { message: `Hi {{lead.name}}! 🌟 How's your first day going? We'd love to hear your thoughts — what can we help you with?` } },
        { type: 'update_lead', config: { stage: 'contacted' } },
        { type: 'create_task', config: { title: 'Personal follow-up call with {{lead.name}}', priority: 'high', due_hours: 48 } },
        { type: 'wait', config: { duration: 2, unit: 'days' } },
        { type: 'send_whatsapp', config: { message: `Hi {{lead.name}}! 🎯 Your Week 1 Success Guide is here! Here's what top customers do in their first week to get the best results. Keep it up!` } },
        { type: 'update_lead', config: { stage: 'converted' } },
        { type: 'notify', config: { message: '✅ {{lead.name}} completed full onboarding sequence!' } },
      ],
    },
  },
  {
    id: 'client-feedback-router',
    name: 'Client Feedback Router',
    description: 'AI reads incoming conversation transcripts, summarises them and routes to the right department via WhatsApp.',
    category: 'AI Routing',
    icon: '🤖',
    color: '#8b5cf6',
    tags: ['ai', 'routing', 'whatsapp', 'crm'],
    steps_count: 4,
    estimated_time: 'Instant',
    popular: true,
    workflow: {
      name: 'Client Feedback Router',
      description: 'AI summarises client conversations and routes to the right department',
      trigger_type: 'inbound_message',
      trigger_config: {},
      steps: [
        { type: 'ai_outreach', config: { agent: 'Summary Agent', goal: 'Summarize this client conversation in 2–3 sentences and identify the main topic: product issue, invoicing, or travel/trip.' } },
        { type: 'ai_reply', config: { agent: 'Router Agent' } },
        { type: 'notify', config: { message: '📨 Routed feedback from {{lead.name}} → check your department inbox' } },
        { type: 'create_task', config: { title: 'Follow up on client feedback from {{lead.name}}', priority: 'high', due_hours: 4 } },
        { type: 'update_lead', config: { stage: 'contacted' } },
      ],
    },
  },
  {
    id: 'ai-meeting-assistant',
    name: 'AI Pre-Meeting Briefing',
    description: 'Runs hourly, detects upcoming calendar meetings, researches attendees, and sends you a WhatsApp briefing.',
    category: 'Sales Intel',
    icon: '📅',
    color: '#3b82f6',
    tags: ['calendar', 'ai', 'whatsapp', 'research'],
    steps_count: 5,
    estimated_time: 'Per meeting',
    popular: false,
    workflow: {
      name: 'AI Pre-Meeting Briefing',
      description: 'Researches meeting attendees and sends a WhatsApp briefing before each call',
      trigger_type: 'scheduled',
      trigger_config: { cron: 'daily_9am' },
      steps: [
        { type: 'ai_outreach', config: { agent: 'Research Agent', goal: 'Check upcoming meetings and extract attendee details including name, email, and any LinkedIn URLs from the invite description.' } },
        { type: 'ai_outreach', config: { agent: 'Correspondence Agent', goal: 'Find the most recent email exchange with each attendee and summarize the key points discussed.' } },
        { type: 'ai_outreach', config: { agent: 'Briefing Agent', goal: 'Compose a concise WhatsApp briefing covering: meeting time & link, what was last discussed with each attendee, and any open action items. Keep it under 300 words.' } },
        { type: 'send_whatsapp', config: { message: `📅 Pre-meeting briefing for {{lead.name}} — check your notes and be prepared!` } },
        { type: 'update_appointment', config: { reminder_sent: true } },
      ],
    },
  },
  {
    id: 'lead-reactivation',
    name: 'Lead Re-activation',
    description: 'Detects leads silent for 72+ hours and sends a personalised AI re-engagement message.',
    category: 'Recovery',
    icon: '⚡',
    color: '#f59e0b',
    tags: ['inactivity', 'ai', 'whatsapp', 'reactivation'],
    steps_count: 4,
    estimated_time: 'Triggered',
    popular: true,
    workflow: {
      name: 'Lead Re-activation',
      description: 'Automatically re-engages silent leads with a personalised message',
      trigger_type: 'inactivity',
      trigger_config: { hours: 72 },
      steps: [
        { type: 'send_whatsapp', config: { message: `Hi {{lead.name}}! 👋 We noticed we haven't heard from you in a while. Is there anything we can help you with? We'd love to catch up!` } },
        { type: 'create_task', config: { title: 'Re-engagement follow-up: {{lead.name}}', priority: 'high', due_hours: 24 } },
        { type: 'notify', config: { message: '⚡ Re-activation triggered for {{lead.name}} (Score: {{lead.ai_score}})' } },
      ],
    },
  },
  {
    id: 'hot-lead-fast-track',
    name: 'Hot Lead Fast-Track',
    description: 'When AI score exceeds 80, immediately notifies the team and starts a personalised outreach sequence.',
    category: 'Sales',
    icon: '🔥',
    color: '#ef4444',
    tags: ['score', 'ai', 'sales', 'urgent'],
    steps_count: 4,
    estimated_time: 'Instant',
    popular: false,
    workflow: {
      name: 'Hot Lead Fast-Track',
      description: 'Instantly engages high-score leads and alerts the sales team',
      trigger_type: 'lead_score',
      trigger_config: { threshold: 80 },
      steps: [
        { type: 'notify', config: { message: '🔥 HOT LEAD: {{lead.name}} — Score {{lead.ai_score}}! Needs immediate attention.' } },
        { type: 'send_whatsapp', config: { message: `Hi {{lead.name}}! 🌟 Our team has reviewed your profile and would love to get on a quick call — are you free for 15 minutes today or tomorrow?` } },
        { type: 'create_task', config: { title: '🔥 URGENT: Call {{lead.name}} now (Score: {{lead.ai_score}})', priority: 'urgent', due_hours: 2 } },
        { type: 'update_lead', config: { stage: 'negotiation', urgency: 'high' } },
      ],
    },
  },
  {
    id: 'appointment-reminder',
    name: 'Appointment Reminder',
    description: 'Sends WhatsApp reminders 24h and 1h before each appointment with confirmation options.',
    category: 'Appointments',
    icon: '🗓️',
    color: '#ec4899',
    tags: ['appointment', 'reminder', 'whatsapp'],
    steps_count: 3,
    estimated_time: 'Scheduled',
    popular: false,
    workflow: {
      name: 'Appointment Reminder',
      description: 'Automated WhatsApp reminders before each appointment',
      trigger_type: 'appointment',
      trigger_config: { event: 'reminder_24h' },
      steps: [
        { type: 'send_whatsapp', config: { message: `Hi {{lead.name}}! 📅 Reminder: your appointment is tomorrow. Please reply YES to confirm or let us know if you need to reschedule.` } },
        { type: 'update_appointment', config: { reminder_sent: true } },
        { type: 'create_task', config: { title: 'Confirm appointment with {{lead.name}}', priority: 'medium', due_hours: 8 } },
      ],
    },
  },
]

const CATEGORIES = ['All', 'Onboarding', 'AI Routing', 'Sales Intel', 'Recovery', 'Sales', 'Appointments']

// ─── Import modal ─────────────────────────────────────────────────────────────

function ImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [json, setJson] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ steps: number; nodes: number } | null>(null)
  const [error, setError] = useState('')

  const handleImport = async () => {
    if (!json.trim()) { setError('Paste your n8n workflow JSON first.'); return }
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/workflows/import-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n8n_json: json, name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setResult({ steps: data.steps_imported, nodes: data.original_nodes })
      toast.success(`Imported as "${data.data?.name}" with ${data.steps_imported} steps!`)
      setTimeout(() => { onSuccess(); onClose() }, 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 560, borderRadius: 24, background: '#f7fdf8', border: '1px solid rgba(34,197,94,0.2)', boxShadow: '0 32px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#166534,#22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileCode2 style={{ width: 18, height: 18, color: 'white' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Import n8n Template</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Paste any n8n workflow JSON — we'll convert it automatically</div>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 9, background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Name override */}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 6 }}>
              Workflow Name (optional)
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Leave blank to use the n8n workflow name"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 11, background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.09)', fontSize: 12, outline: 'none', color: 'var(--text-primary)' }}
            />
          </div>

          {/* JSON paste */}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 6 }}>
              n8n Workflow JSON *
            </label>
            <textarea
              value={json}
              onChange={e => setJson(e.target.value)}
              placeholder={'Paste your n8n workflow JSON here...\n\nExport from n8n: open a workflow → ⋯ → Download'}
              rows={10}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 11, background: 'rgba(0,0,0,0.03)', border: `1px solid ${error ? 'rgba(239,68,68,0.4)' : 'rgba(0,0,0,0.09)'}`, fontSize: 11, outline: 'none', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'DM Mono, monospace', lineHeight: 1.6 }}
            />
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 11, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle style={{ width: 14, height: 14, color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: '#dc2626' }}>{error}</span>
            </div>
          )}

          {result && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 11, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <CheckCircle2 style={{ width: 14, height: 14, color: '#22c55e' }} />
              <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>
                Converted {result.nodes} n8n nodes → {result.steps} StrixMind steps
              </span>
            </div>
          )}

          {/* How it works */}
          <div style={{ padding: '11px 14px', borderRadius: 12, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#6366f1', marginBottom: 7 }}>What gets converted</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {[
                ['Email nodes', '→ WhatsApp messages'],
                ['Wait / delay', '→ Wait step'],
                ['Telegram / Slack', '→ Team notification'],
                ['HubSpot update', '→ Lead stage update'],
                ['AI / LLM chains', '→ AI Outreach step'],
                ['Webhook trigger', '→ Inbound message'],
                ['Schedule trigger', '→ Scheduled trigger'],
                ['IF / validation', '→ Condition branch'],
              ].map(([from, to], i) => (
                <div key={i} style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{from}</span> {to}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 20px 20px', display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleImport} disabled={loading || !json.trim()} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#166534,#22c55e)', border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(34,197,94,0.35)', opacity: (!json.trim() || loading) ? 0.6 : 1 }}>
            {loading ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Upload style={{ width: 14, height: 14 }} />}
            {loading ? 'Converting…' : 'Import & Convert'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Template preview modal ───────────────────────────────────────────────────

function PreviewModal({ template, onClose, onInstall }: { template: typeof TEMPLATES[0]; onClose: () => void; onInstall: () => void }) {
  const steps = template.workflow.steps
  const stepColors: Record<string, string> = {
    send_whatsapp: '#25d366', notify: '#3b82f6', wait: '#06b6d4',
    update_lead: '#f59e0b', create_task: '#22c55e', ai_outreach: '#8b5cf6',
    ai_reply: '#8b5cf6', update_appointment: '#ec4899', condition: '#6366f1',
  }
  const stepLabels: Record<string, string> = {
    send_whatsapp: 'WhatsApp Message', notify: 'Team Notification', wait: 'Wait',
    update_lead: 'Update Lead', create_task: 'Create Task', ai_outreach: 'AI Outreach',
    ai_reply: 'AI Auto-Reply', update_appointment: 'Update Appointment', condition: 'Condition',
  }
  const stepIcons: Record<string, string> = {
    send_whatsapp: '💬', notify: '🔔', wait: '⏱️', update_lead: '🏷️',
    create_task: '✅', ai_outreach: '🧠', ai_reply: '🤖', update_appointment: '📅', condition: '🔀',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', borderRadius: 24, background: '#f7fdf8', border: '1px solid rgba(34,197,94,0.2)', boxShadow: '0 32px 80px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: `${template.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            {template.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{template.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{template.steps_count} steps · {template.estimated_time}</div>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 9, background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <X style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 18 }}>{template.description}</p>

          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 10 }}>
            Workflow Steps ({steps.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Trigger */}
            <div style={{ padding: '11px 14px', borderRadius: 13, background: `${template.color}0e`, border: `1px solid ${template.color}30`, marginBottom: 4 }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: template.color, marginBottom: 2 }}>TRIGGER</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                {template.workflow.trigger_type === 'inbound_message' ? '💬 Inbound Message' :
                  template.workflow.trigger_type === 'inactivity' ? '⏱️ Inactivity Timer (72h)' :
                  template.workflow.trigger_type === 'lead_score' ? `📊 Lead Score ≥ ${template.workflow.trigger_config.threshold ?? 80}` :
                  template.workflow.trigger_type === 'appointment' ? '📅 Appointment Event' :
                  template.workflow.trigger_type === 'scheduled' ? '🕐 Scheduled (Daily 9 AM)' : '👆 Manual'}
              </div>
            </div>

            {steps.map((step, i) => {
              const color = stepColors[step.type] ?? '#22c55e'
              const label = stepLabels[step.type] ?? step.type
              const emoji = stepIcons[step.type] ?? '⚡'
              const preview = (step.config as any)?.message?.slice(0, 60) ||
                (step.config as any)?.title?.slice(0, 50) ||
                (step.config as any)?.goal?.slice(0, 50) ||
                ((step.config as any)?.duration ? `${(step.config as any).duration} ${(step.config as any).unit}` : '') ||
                ((step.config as any)?.stage ? `stage → ${(step.config as any).stage}` : '') ||
                ''
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '3px 0' }}>
                    <svg width="2" height="14"><line x1="1" y1="0" x2="1" y2="14" stroke="rgba(34,197,94,0.3)" strokeWidth="2" strokeDasharray="3 2" /></svg>
                  </div>
                  <div style={{ padding: '9px 12px', borderRadius: 11, background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
                      {preview && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}{preview.length >= 50 ? '…' : ''}</div>}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: color, flexShrink: 0 }}>STEP {i + 1}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
          <button onClick={onInstall} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', borderRadius: 13, fontSize: 13, fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#166534,#22c55e)', border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(34,197,94,0.35)' }}>
            <Download style={{ width: 15, height: 15 }} />
            Install Template
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main WorkflowTemplates component ─────────────────────────────────────────

export default function WorkflowTemplates({ onTemplateInstalled }: { onTemplateInstalled?: () => void }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [showImport, setShowImport] = useState(false)
  const [preview, setPreview] = useState<typeof TEMPLATES[0] | null>(null)
  const [installing, setInstalling] = useState<string | null>(null)
  const [installed, setInstalled] = useState<Set<string>>(new Set())

  const filtered = TEMPLATES.filter(t => {
    const matchCat = category === 'All' || t.category === category
    const matchSearch = !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some(tag => tag.includes(search.toLowerCase()))
    return matchCat && matchSearch
  })

  const installTemplate = async (template: typeof TEMPLATES[0]) => {
    setInstalling(template.id); setPreview(null)
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...template.workflow, active: false, run_count: 0, success_count: 0 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to install')
      setInstalled(prev => new Set([...prev, template.id]))
      qc.invalidateQueries({ queryKey: ['workflows'] })
      toast.success(`"${template.name}" installed! Go to Automation to configure and activate it.`)
      onTemplateInstalled?.()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setInstalling(null)
    }
  }

  const handleImportSuccess = () => {
    qc.invalidateQueries({ queryKey: ['workflows'] })
    onTemplateInstalled?.()
  }

  return (
    <div>
      {showImport && <ImportModal onClose={() => setShowImport(false)} onSuccess={handleImportSuccess} />}
      {preview && <PreviewModal template={preview} onClose={() => setPreview(null)} onInstall={() => installTemplate(preview)} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#166534,#22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles style={{ width: 16, height: 16, color: 'white' }} />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
              Workflow Templates
            </h2>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            One-click install · or import any n8n workflow JSON
          </p>
        </div>
        <button
          onClick={() => setShowImport(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#4f46e5' }}
        >
          <FileCode2 style={{ width: 13, height: 13 }} />
          Import n8n JSON
        </button>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates…"
            style={{ width: '100%', paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 11, background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', fontSize: 12, outline: 'none', color: 'var(--text-primary)' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{ padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: category === cat ? 'linear-gradient(135deg,#166534,#22c55e)' : 'rgba(0,0,0,0.05)', color: category === cat ? 'white' : 'var(--text-secondary)', transition: 'all 0.15s' }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* n8n import tip banner */}
      <div style={{ padding: '12px 16px', borderRadius: 14, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
        <FileCode2 style={{ width: 18, height: 18, color: '#6366f1', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#4338ca', marginBottom: 2 }}>Use your own n8n workflows</div>
          <div style={{ fontSize: 11, color: '#6366f1' }}>
            Export any n8n workflow as JSON and import it here — email nodes become WhatsApp messages, AI chains become AI Outreach steps, and CRM nodes update your leads automatically.
          </div>
        </div>
        <button onClick={() => setShowImport(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 10, background: '#6366f1', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>
          Import <ChevronRight style={{ width: 11, height: 11 }} />
        </button>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {filtered.map(template => {
          const isInstalled = installed.has(template.id)
          const isInstalling = installing === template.id
          return (
            <div key={template.id} style={{ borderRadius: 18, background: 'rgba(255,255,255,0.85)', border: `1px solid ${isInstalled ? 'rgba(34,197,94,0.3)' : 'rgba(0,0,0,0.07)'}`, overflow: 'hidden', transition: 'all 0.2s', boxShadow: isInstalled ? '0 0 0 2px rgba(34,197,94,0.12)' : 'none' }}>
              {/* Card header */}
              <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, background: `${template.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {template.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{template.name}</span>
                    {template.popular && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: `${template.color}18`, color: template.color }}>Popular</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: template.color, fontWeight: 700 }}>{template.category}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>·</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{template.steps_count} steps</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>·</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{template.estimated_time}</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '0 16px 14px' }}>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 12px' }}>{template.description}</p>

                {/* Tags */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                  {template.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: 'rgba(0,0,0,0.04)', color: 'var(--text-muted)', fontWeight: 600 }}>
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setPreview(template)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', borderRadius: 10, background: 'rgba(0,0,0,0.04)', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}
                  >
                    <Eye style={{ width: 11, height: 11 }} /> Preview
                  </button>
                  <button
                    onClick={() => installTemplate(template)}
                    disabled={isInstalled || isInstalling}
                    style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', borderRadius: 10, border: 'none', cursor: (isInstalled || isInstalling) ? 'default' : 'pointer', fontSize: 11, fontWeight: 700, color: 'white', background: isInstalled ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg,#166534,#22c55e)', transition: 'all 0.15s', boxShadow: isInstalled ? 'none' : '0 2px 10px rgba(34,197,94,0.3)' }}
                  >
                    {isInstalling
                      ? <><Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> Installing…</>
                      : isInstalled
                        ? <><CheckCircle2 style={{ width: 11, height: 11, color: '#22c55e' }} /> <span style={{ color: '#166534' }}>Installed</span></>
                        : <><Download style={{ width: 11, height: 11 }} /> Install</>}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Search style={{ width: 28, height: 28, color: 'rgba(0,0,0,0.12)' }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>No templates match "{search}"</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Try a different search, or import your own n8n workflow above</div>
        </div>
      )}
    </div>
  )
}
