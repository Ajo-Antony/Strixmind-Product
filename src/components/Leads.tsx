'use client'
import { useState } from 'react'
import { useLeads, useUpdateLead, useCreateLead, useDeleteLead, useCSVExport, useAnalyzeLead, useBulkAnalyzeLeads, useRegenerateFollowUp } from '@/lib/hooks'
import { getInitials, formatCurrency, formatTime, STAGE_LABELS, STAGE_COLORS, scoreColor } from '@/lib/utils'
import { Plus, Search, Trash2, Loader2, Upload, Download, LayoutGrid, List, Target, ChevronDown, Brain, Sparkles, RefreshCw, Webhook, ShieldCheck, AlertCircle, Calendar, Clock, Send, ShieldAlert, Sparkle, RefreshCcw, CheckCircle2 } from 'lucide-react'
import AgentOutreach from './AgentOutreach'
import { toast } from 'sonner'
import CSVImporter from './CSVImporter'
import CampaignsSection from './CampaignsSection'
import LeadIntakePage from './LeadIntakePage'

const STAGES = ['new','qualified','contacted','scheduled','negotiation','converted']

type TabId = 'board' | 'table' | 'import' | 'campaigns' | 'outreach' | 'intake'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/6 ${className}`} />
}

// ─── Lead Card (Kanban) ───────────────────────────────────────
function LeadCard({
  lead,
  onStageChange,
  onContact,
  onScore,
  scoring,
  onSelect,
}: {
  lead: any
  onStageChange: (id: string, stage: string) => void
  onContact?: (lead: any) => void
  onScore?: (lead: any) => void
  scoring?: boolean
  onSelect?: (lead: any) => void
}) {
  const deleteLead = useDeleteLead()
  const isUnscored = !lead.ai_score || lead.ai_score === 0

  return (
    <div
      onClick={() => onSelect?.(lead)}
      className="p-3.5 rounded-2xl mb-2 group transition-all hover:-translate-y-0.5 cursor-pointer hover:shadow-md"
      style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', color: '#166534' }}
          >
            {getInitials(lead.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{lead.name}</div>
            <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{lead.phone}</div>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm('Delete lead?')) deleteLead.mutate(lead.id) }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 transition-all flex-shrink-0"
        >
          <Trash2 className="w-3 h-3" style={{ color: '#dc2626' }} />
        </button>
      </div>

      {/* Budget */}
      {lead.budget && (
        <div className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {formatCurrency(lead.budget)}
        </div>
      )}

      {/* AI Score row */}
      <div className="mb-2">
        <div className="flex justify-between items-center text-[10px] mb-1">
          <span style={{ color: 'var(--text-muted)' }}>AI Score</span>
          <div className="flex items-center gap-1.5">
            {isUnscored ? (
              <span style={{ color: 'var(--text-muted)' }}>—</span>
            ) : (
              <span className="font-bold" style={{ color: scoreColor(lead.ai_score) }}>{lead.ai_score}</span>
            )}
            {/* Per-card score / re-score button */}
            <button
              onClick={(e) => { e.stopPropagation(); onScore?.(lead) }}
              disabled={scoring}
              title={isUnscored ? 'Score this lead with AI' : 'Re-score with AI'}
              className="p-0.5 rounded hover:bg-purple-50 transition-colors disabled:opacity-40"
            >
              {scoring
                ? <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#8b5cf6' }} />
                : <Sparkles className="w-3 h-3" style={{ color: isUnscored ? '#8b5cf6' : 'var(--text-muted)' }} />
              }
            </button>
          </div>
        </div>
        {/* Only render the progress bar when there's actually a score */}
        {!isUnscored && (
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${lead.ai_score}%`,
                background: `linear-gradient(90deg,${scoreColor(lead.ai_score)},${scoreColor(lead.ai_score)}99)`,
              }}
            />
          </div>
        )}
      </div>

      {/* Intent + urgency */}
      {lead.intent && (
        <div className="text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>
          {lead.intent.replace(/_/g, ' ')}
          {lead.urgency && (
            <span className="ml-1" style={{ color: lead.urgency === 'high' ? '#dc2626' : 'inherit' }}>
              · {lead.urgency}
            </span>
          )}
        </div>
      )}

      {/* AI Summary */}
      {lead.ai_summary && (
        <div className="text-[10px] mb-2 leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>
          {lead.ai_summary}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatTime(lead.updated_at)}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onContact?.(lead) }}
            title="Contact via Agent"
            className="p-1 rounded-lg hover:bg-emerald-50 transition-colors"
            style={{ opacity: 0.7 }}
          >
            <Brain className="w-3 h-3" style={{ color: '#22c55e' }} />
          </button>
          <select
            value={lead.stage}
            onChange={e => { e.stopPropagation(); onStageChange(lead.id, e.target.value) }}
            onClick={e => e.stopPropagation()}
            className="text-[10px] px-1.5 py-0.5 rounded-lg outline-none cursor-pointer border"
            style={{ background: STAGE_COLORS[lead.stage]?.bg, color: STAGE_COLORS[lead.stage]?.text, borderColor: 'transparent' }}
          >
            {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

// ─── Table Row ────────────────────────────────────────────────
function TableRow({
  lead,
  onStageChange,
  onScore,
  scoring,
  onSelect,
}: {
  lead: any
  onStageChange: (id: string, stage: string) => void
  onScore?: (lead: any) => void
  scoring?: boolean
  onSelect?: (lead: any) => void
}) {
  const deleteLead = useDeleteLead()
  const sc = STAGE_COLORS[lead.stage] ?? STAGE_COLORS.new
  const isUnscored = !lead.ai_score || lead.ai_score === 0

  return (
    <tr
      onClick={() => onSelect?.(lead)}
      className="group hover:bg-green-50/40 transition-colors border-b cursor-pointer"
      style={{ borderColor: 'rgba(0,0,0,0.04)' }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', color: '#166534' }}
          >
            {getInitials(lead.name)}
          </div>
          <div>
            <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{lead.name}</div>
            {lead.email && <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{lead.email}</div>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{lead.phone}</td>
      <td className="px-4 py-3">
        <select
          value={lead.stage}
          onChange={e => { e.stopPropagation(); onStageChange(lead.id, e.target.value) }}
          onClick={e => e.stopPropagation()}
          className="text-[10px] px-2 py-1 rounded-lg outline-none cursor-pointer border"
          style={{ background: sc.bg, color: sc.text, borderColor: 'transparent' }}
        >
          {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {isUnscored ? (
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>—</span>
          ) : (
            <>
              <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${lead.ai_score}%`, background: scoreColor(lead.ai_score) }}
                />
              </div>
              <span className="text-[11px] font-bold" style={{ color: scoreColor(lead.ai_score) }}>{lead.ai_score}</span>
            </>
          )}
          {/* Score button — visible on row hover */}
          <button
            onClick={(e) => { e.stopPropagation(); onScore?.(lead) }}
            disabled={scoring}
            title={isUnscored ? 'Score with AI' : 'Re-score'}
            className="p-0.5 rounded hover:bg-purple-50 transition-colors disabled:opacity-40 opacity-0 group-hover:opacity-100"
          >
            {scoring
              ? <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#8b5cf6' }} />
              : <Sparkles className="w-3 h-3" style={{ color: '#8b5cf6' }} />
            }
          </button>
        </div>
      </td>
      <td className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
        {lead.budget ? formatCurrency(lead.budget) : '—'}
      </td>
      <td className="px-4 py-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatTime(lead.created_at)}</td>
      <td className="px-4 py-3">
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm('Delete lead?')) deleteLead.mutate(lead.id) }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 transition-all"
        >
          <Trash2 className="w-3 h-3" style={{ color: '#dc2626' }} />
        </button>
      </td>
    </tr>
  )
}

// ─── Add Lead Modal ───────────────────────────────────────────
function AddLeadModal({ onClose }: { onClose: () => void }) {
  const createLead = useCreateLead()
  const analyzeLead = useAnalyzeLead()
  const [form, setForm] = useState({ name: '', phone: '', email: '', budget: '', stage: 'new', notes: '' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit() {
    if (!form.name || !form.phone) return toast.error('Name and phone required')
    try {
      const created = await createLead.mutateAsync({
        ...form,
        budget: form.budget ? parseFloat(form.budget) : null,
      })
      toast.success('Lead created — AI scoring in background…')
      onClose()
      // Kick off AI scoring immediately (non-blocking — modal already closed)
      if (created?.id) analyzeLead.mutate(created.id)
    } catch (err: any) { toast.error(err.message) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}>
      <div className="glass rounded-3xl p-6 w-full max-w-md" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Add New Lead</h2>
        <div className="space-y-3">
          {[
            { key: 'name',   label: 'Full Name *',  placeholder: 'Priya Sharma',       type: 'text'   },
            { key: 'phone',  label: 'Phone *',       placeholder: '+91 98765 43210',    type: 'text'   },
            { key: 'email',  label: 'Email',         placeholder: 'priya@example.com',  type: 'email'  },
            { key: 'budget', label: 'Budget (₹)',    placeholder: '500000',             type: 'number' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
              <input
                type={f.type}
                value={(form as any)[f.key]}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }}
              />
            </div>
          ))}
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Stage</label>
            <select
              value={form.stage}
              onChange={e => set('stage', e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }}
            >
              {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder="Any notes…"
              className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm"
            style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createLead.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm text-white font-medium flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}
          >
            {createLead.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Create Lead
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Lead Detail & Followup Hub Modal ─────────────────────────
function LeadDetailModal({
  lead: initialLead,
  onClose,
  onScore,
  scoring,
}: {
  lead: any
  onClose: () => void
  onScore?: (lead: any) => void
  scoring?: boolean
}) {
  const updateLead = useUpdateLead()
  const regenerateFollowup = useRegenerateFollowUp()
  const [lead, setLead] = useState(initialLead)
  const [notes, setNotes] = useState(lead.notes || '')
  const [stage, setStage] = useState(lead.stage || 'new')
  const [draft, setDraft] = useState(lead.metadata?.followup_message_draft || '')
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)

  // Sync state if initialLead changes
  useState(() => {
    setLead(initialLead)
    setNotes(initialLead.notes || '')
    setStage(initialLead.stage || 'new')
    setDraft(initialLead.metadata?.followup_message_draft || '')
  })

  const meta = lead.metadata ?? {}
  const isGenuine = meta.is_genuine !== false
  const genScore = meta.genuineness_score ?? (lead.ai_score ? Math.min(100, Math.max(0, lead.ai_score + 5)) : 80)
  const genReason = meta.genuineness_reasoning || lead.ai_summary || 'Verification details pending scoring...'
  const isSent = meta.followup_sent === true
  const scheduledAt = meta.scheduled_followup_at
  const followupHours = meta.recommended_next_followup_hours ?? 24

  async function handleSave() {
    setSaving(true)
    try {
      const updatedMeta = {
        ...meta,
        followup_message_draft: draft,
      }
      await updateLead.mutateAsync({
        id: lead.id,
        notes,
        stage,
        metadata: updatedMeta,
      })
      toast.success('Changes saved successfully')
    } catch (err: any) {
      toast.error('Failed to save changes: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRegenerate() {
    try {
      toast.info('Regenerating follow-up draft using AI context...')
      const result = await regenerateFollowup.mutateAsync(lead.id)
      const newDraft = result?.data?.draft || ''
      setDraft(newDraft)
      setLead((l: any) => ({
        ...l,
        metadata: {
          ...(l.metadata ?? {}),
          followup_message_draft: newDraft,
        },
      }))
      toast.success('New draft successfully written!')
    } catch (err: any) {
      toast.error('Regeneration failed: ' + err.message)
    }
  }

  async function handleSendNow() {
    if (!draft) return toast.error('No follow-up message draft exists to send!')
    setSending(true)
    try {
      toast.info('Dispatching hyper-personalized WhatsApp follow-up...')
      const res = await fetch(`/api/workflows/cron?leadId=${lead.id}`, { method: 'POST' })
      const data = await res.json()
      if (data.success && data.processed > 0) {
        toast.success('WhatsApp follow-up successfully sent and registered in thread!')
        setLead((l: any) => ({
          ...l,
          metadata: {
            ...(l.metadata ?? {}),
            followup_sent: true,
            followup_sent_at: new Date().toISOString(),
          },
        }))
      } else {
        throw new Error(data.error || 'WhatsApp message failed to deliver. Make sure WhatsApp is connected.')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSending(false)
    }
  }

  async function handleDelayFollowup(hours: number) {
    try {
      const futureTime = new Date(Date.now() + hours * 3600_000).toISOString()
      const updatedMeta = {
        ...meta,
        scheduled_followup_at: futureTime,
        recommended_next_followup_hours: hours,
        followup_sent: false,
      }
      await updateLead.mutateAsync({
        id: lead.id,
        metadata: updatedMeta,
      })
      setLead((l: any) => ({ ...l, metadata: updatedMeta }))
      toast.success(`Rescheduled follow-up in ${hours} hours`)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md" onClick={onClose}>
      <div
        className="glass rounded-3xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ boxShadow: '0 25px 70px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b flex justify-between items-start" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-emerald-800"
              style={{ background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)' }}
            >
              {getInitials(lead.name)}
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{lead.name}</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{lead.phone} {lead.email ? `· ${lead.email}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-black/5 text-gray-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top row: Profile and Genuineness Assessment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Left Box: Basic CRM Attributes */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Core Lead Data</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-black/2 rounded-2xl border border-black/4">
                  <div className="text-[10px] text-gray-400 font-medium">Pipeline Stage</div>
                  <select
                    value={stage}
                    onChange={e => setStage(e.target.value)}
                    className="w-full mt-1 bg-transparent text-xs font-semibold focus:outline-none border-none p-0 cursor-pointer text-emerald-800"
                  >
                    {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                  </select>
                </div>

                <div className="p-3 bg-black/2 rounded-2xl border border-black/4">
                  <div className="text-[10px] text-gray-400 font-medium">Lead Budget</div>
                  <div className="text-xs font-bold mt-1 text-gray-800">
                    {lead.budget ? formatCurrency(lead.budget) : 'Unspecified'}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">CRM Notes & Background</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add notes about client preference, budget details, or scheduling constraints..."
                  className="w-full text-xs p-3 rounded-2xl bg-black/2 border border-black/6 focus:outline-none focus:border-emerald-500 min-h-[90px] resize-none"
                />
              </div>
            </div>

            {/* Right Box: Lead Genuineness & Authentication Hub */}
            <div className="p-4 rounded-2xl border flex flex-col justify-between" style={{ background: isGenuine ? 'rgba(34,197,94,0.02)' : 'rgba(239,68,68,0.02)', borderColor: isGenuine ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Verification Engine</span>
                  <div className="flex items-center gap-1">
                    {isGenuine ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                        <ShieldCheck className="w-3.5 h-3.5" /> VERIFIED GENUINE
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                        <AlertCircle className="w-3.5 h-3.5" /> SUSPICIOUS LEAD
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 rounded-full border-4 flex items-center justify-center font-bold text-base" style={{ borderColor: isGenuine ? '#22c55e' : '#f59e0b', color: isGenuine ? '#15803d' : '#b45309' }}>
                    {genScore}%
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-800">Authenticity Score</div>
                    <div className="text-[10px] text-gray-400">Confidence calculation by AI agent</div>
                  </div>
                </div>

                <div className="text-xs p-3 bg-white/40 rounded-xl border border-black/4 leading-relaxed max-h-[100px] overflow-y-auto text-gray-600">
                  {genReason}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 text-[10px] text-gray-400">
                <Brain className="w-3.5 h-3.5 text-purple-500" />
                <span>Intent parsed as: <strong className="text-gray-700">{lead.intent ? lead.intent.replace(/_/g, ' ') : 'General Enquiry'}</strong></span>
              </div>
            </div>

          </div>

          {/* Bottom row: 24/7 Smart Follow-Up Section */}
          <div className="border-t pt-5" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                  24/7 WhatsApp Follow-Up Queue
                </h3>
                <p className="text-[11px] text-gray-400">StrixMind automatically drafts, schedules, and sends follow-ups to qualified leads.</p>
              </div>

              {/* Follow-up status */}
              <div>
                {isSent ? (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Sent ✓
                  </span>
                ) : scheduledAt ? (
                  <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Scheduled in {followupHours} hours
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    No followup scheduled
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 bg-emerald-50/10 border border-emerald-100 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                  <Sparkle className="w-3.5 h-3.5 text-purple-500" /> AI-Generated Draft Message
                </span>
                <button
                  onClick={handleRegenerate}
                  disabled={regenerateFollowup.isPending}
                  className="text-[11px] text-purple-700 font-bold flex items-center gap-1 hover:underline disabled:opacity-40"
                >
                  {regenerateFollowup.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                  Regenerate Draft with AI
                </button>
              </div>

              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Write or edit follow-up message draft..."
                className="w-full text-xs p-3 rounded-xl bg-white border border-emerald-100/60 focus:outline-none focus:border-emerald-500 min-h-[70px] text-gray-700 shadow-sm animate-none"
              />

              <div className="flex flex-wrap gap-2 pt-1 items-center justify-between">
                {/* Reschedule buttons */}
                <div className="flex gap-1 items-center">
                  <span className="text-[10px] text-gray-400 mr-1">Delay:</span>
                  {[
                    { label: '6h', hours: 6 },
                    { label: '12h', hours: 12 },
                    { label: '24h', hours: 24 },
                    { label: '48h', hours: 48 },
                  ].map(b => (
                    <button
                      key={b.hours}
                      onClick={() => handleDelayFollowup(b.hours)}
                      className="text-[10px] px-2 py-1 rounded-lg bg-white border hover:bg-emerald-50 text-gray-600 font-medium transition-colors"
                    >
                      +{b.label}
                    </button>
                  ))}
                </div>

                {/* Immediate send button */}
                <button
                  onClick={handleSendNow}
                  disabled={sending || !draft}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-md disabled:opacity-40 transition-all hover:brightness-105"
                  style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}
                >
                  {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Send WhatsApp Message Now
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-black/2 border-t flex justify-end gap-2" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-white border hover:bg-black/2 text-gray-600"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-md hover:brightness-105"
            style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save All Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Leads Component ─────────────────────────────────────
export default function Leads() {
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('board')
  const [selectedLead, setSelectedLead] = useState<any | null>(null)
  // Tracks which single lead is currently being scored (for per-card spinner)
  const [scoringId, setScoringId] = useState<string | null>(null)

  const { data: leads, isLoading } = useLeads(stageFilter || undefined, search)
  const updateLead    = useUpdateLead()
  const csvExport     = useCSVExport()
  const analyzeLead   = useAnalyzeLead()
  const bulkAnalyze   = useBulkAnalyzeLeads()

  const byStage = STAGES.reduce((acc, s) => {
    acc[s] = (leads ?? []).filter((l: any) => l.stage === s)
    return acc
  }, {} as Record<string, any[]>)

  // Only include scored leads in the average — unscored (0 / null) are excluded
  const scoredLeads   = (leads ?? []).filter((l: any) => l.ai_score && l.ai_score > 0)
  const unscoredLeads = (leads ?? []).filter((l: any) => !l.ai_score || l.ai_score === 0)
  const avgScore      = scoredLeads.length
    ? Math.round((scoredLeads as any[]).reduce((s: number, l: any) => s + (l.ai_score ?? 0), 0) / scoredLeads.length)
    : 0

  const converted = (leads ?? []).filter((l: any) => l.stage === 'converted').length
  const convRate   = leads?.length ? Math.round((converted / (leads as any[]).length) * 100) : 0

  const onStageChange = async (id: string, stage: string) => {
    try {
      await updateLead.mutateAsync({
        id,
        stage,
        ...(stage === 'converted' ? { converted_at: new Date().toISOString() } : {}),
      })
      toast.success(`Moved to ${STAGE_LABELS[stage]}`)
    } catch (err: any) { toast.error(err.message) }
  }

  // Score a single lead (called from card ✨ button or table row button)
  const onScore = async (lead: any) => {
    setScoringId(lead.id)
    try {
      const result = await analyzeLead.mutateAsync(lead.id)
      toast.success(`${lead.name} scored ${result?.ai_score ?? '?'}/100`)
    } catch (err: any) {
      toast.error(`Scoring failed: ${err.message}`)
    } finally {
      setScoringId(null)
    }
  }

  // Bulk-score all leads that still have ai_score = 0 / null
  const onBulkScore = async () => {
    if (unscoredLeads.length === 0) { toast('All leads already have AI scores ✓'); return }
    toast(`Scoring ${unscoredLeads.length} lead${unscoredLeads.length > 1 ? 's' : ''}…`)
    try {
      const results = await bulkAnalyze.mutateAsync(unscoredLeads.map((l: any) => l.id))
      const ok = (results as any[]).filter((r: any) => r.ai_score !== undefined).length
      toast.success(`Scored ${ok}/${(results as any[]).length} leads`)
    } catch (err: any) { toast.error(err.message) }
  }

  const TABS: { id: TabId; label: string; icon: any }[] = [
    { id: 'board',     label: 'Board',          icon: LayoutGrid },
    { id: 'table',     label: 'Table',          icon: List       },
    { id: 'outreach',  label: 'Agent Outreach', icon: Brain      },
    { id: 'import',    label: 'Import CSV',     icon: Upload     },
    { id: 'intake',    label: 'Lead Intake',    icon: Webhook    },
    { id: 'campaigns', label: 'Campaigns',      icon: Target     },
  ]

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 84px)' }}>
      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} />}

      {/* ── Stats Bar ── */}
      {activeTab !== 'campaigns' && (
        <div className="glass rounded-2xl p-3 mb-4 flex-shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Leads', value: (leads ?? []).length,                   color: '#8b5cf6' },
            { label: 'Avg AI Score', value: scoredLeads.length ? avgScore : '—',   color: '#22c55e' },
            { label: 'Converted',   value: converted,                              color: '#3b82f6' },
            { label: 'Conv. Rate',  value: `${convRate}%`,                         color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} className="text-center py-1">
              <div className="text-lg font-bold" style={{ color: s.color, letterSpacing: '-0.04em' }}>
                {isLoading ? '—' : s.value}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab Bar + Actions ── */}
      <div className="glass rounded-2xl p-3 mb-4 flex items-center gap-2 flex-shrink-0 flex-wrap">

        {/* Tabs */}
        <div className="flex gap-1 bg-black/4 rounded-xl p-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background:  activeTab === tab.id ? 'white'           : 'transparent',
                color:       activeTab === tab.id ? '#166534'         : 'var(--text-muted)',
                boxShadow:   activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <tab.icon className="w-3 h-3" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Search + Stage filter (board / table only) */}
        {(activeTab === 'board' || activeTab === 'table') && (
          <>
            <div
              className="flex items-center gap-2 flex-1 min-w-32 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}
            >
              <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search leads…"
                className="flex-1 bg-transparent text-xs outline-none min-w-0"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
            <div className="relative">
              <select
                value={stageFilter}
                onChange={e => setStageFilter(e.target.value)}
                className="appearance-none pl-2.5 pr-6 py-2 rounded-xl text-xs outline-none cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}
              >
                <option value="">All Stages</option>
                {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
              <ChevronDown
                className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
            </div>
          </>
        )}

        {/* Right-side action buttons */}
        <div className="flex gap-1.5 ml-auto">

          {/* "Score N unscored" — only visible when unscored leads exist */}
          {(activeTab === 'board' || activeTab === 'table') && unscoredLeads.length > 0 && (
            <button
              onClick={onBulkScore}
              disabled={bulkAnalyze.isPending}
              title={`Score ${unscoredLeads.length} unscored lead${unscoredLeads.length > 1 ? 's' : ''} with AI`}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs"
              style={{ background: 'rgba(139,92,246,0.08)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' }}
            >
              {bulkAnalyze.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Sparkles className="w-3.5 h-3.5" />
              }
              <span className="hidden sm:inline">
                {bulkAnalyze.isPending ? 'Scoring…' : `Score ${unscoredLeads.length} unscored`}
              </span>
            </button>
          )}

          {/* Export CSV */}
          {(activeTab === 'board' || activeTab === 'table') && (
            <button
              onClick={() => csvExport.mutate({ stage: stageFilter, search })}
              disabled={csvExport.isPending}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs"
              style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}
            >
              {csvExport.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          {/* Add Lead */}
          {activeTab !== 'campaigns' && activeTab !== 'import' && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-white"
              style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Lead</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}

      {/* Board (Kanban) */}
      {activeTab === 'board' && (
        <div className="flex gap-3 overflow-x-auto flex-1 pb-2" style={{ minHeight: 0 }}>
          {STAGES.map(stage => {
            const stageleads = byStage[stage] ?? []
            const sc = STAGE_COLORS[stage]
            return (
              <div key={stage} className="flex-shrink-0 flex flex-col" style={{ width: 220 }}>
                <div className="flex items-center justify-between mb-2.5 px-0.5">
                  <span
                    className="text-[11px] px-2.5 py-1 rounded-full font-semibold"
                    style={{ background: sc.bg, color: sc.text }}
                  >
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{stageleads.length}</span>
                </div>
                <div
                  className="flex-1 overflow-y-auto rounded-2xl p-2"
                  style={{ background: 'rgba(0,0,0,0.02)', border: '1px dashed rgba(0,0,0,0.07)', minHeight: 80 }}
                >
                  {isLoading
                    ? Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-28 w-full mb-2" />)
                    : stageleads.length === 0
                      ? <div className="flex items-center justify-center h-16 text-[11px]" style={{ color: 'var(--text-muted)' }}>Empty</div>
                      : stageleads.map((l: any) => (
                          <LeadCard
                            key={l.id}
                            lead={l}
                            onStageChange={onStageChange}
                            onScore={onScore}
                            scoring={scoringId === l.id}
                            onSelect={setSelectedLead}
                          />
                        ))
                  }
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Table */}
      {activeTab === 'table' && (
        <div className="glass rounded-2xl overflow-hidden flex-1" style={{ minHeight: 0 }}>
          <div className="overflow-auto h-full">
            <table className="w-full min-w-[640px]">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)' }}>
                <tr className="border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                  {['Name', 'Phone', 'Stage', 'AI Score', 'Budget', 'Added', ''].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array(6).fill(0).map((_, i) => (
                      <tr key={i} className="border-b" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                        {Array(7).fill(0).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  : (leads ?? []).length === 0
                    ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
                          No leads found. Try adjusting filters or adding new leads.
                        </td>
                      </tr>
                    )
                    : (leads ?? []).map((l: any) => (
                        <TableRow
                          key={l.id}
                          lead={l}
                          onStageChange={onStageChange}
                          onScore={onScore}
                          scoring={scoringId === l.id}
                          onSelect={setSelectedLead}
                        />
                      ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'outreach' && (
        <div className="flex-1">
          <AgentOutreach />
        </div>
      )}

      {activeTab === 'import' && (
        <div className="glass rounded-2xl p-6 max-w-xl">
          <div className="mb-5">
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Import Leads from CSV</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Bulk-upload leads. Requires{' '}
              <code className="bg-black/5 px-1 rounded">name</code>,{' '}
              <code className="bg-black/5 px-1 rounded">phone</code>, and{' '}
              <code className="bg-black/5 px-1 rounded">business_name</code> columns.
            </p>
          </div>
          <CSVImporter onDone={() => setActiveTab('table')} />
        </div>
      )}

      
      {activeTab === 'intake' && (
        <LeadIntakePage />
      )}

{activeTab === 'campaigns' && (
        <div className="flex-1">
          <CampaignsSection />
        </div>
      )}

      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onScore={onScore}
          scoring={scoringId === selectedLead.id}
        />
      )}
    </div>
  )
}
