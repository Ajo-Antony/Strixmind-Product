'use client'
import { useState } from 'react'
import { useLeads, useUpdateLead, useCreateLead, useDeleteLead, useCSVExport, useAnalyzeLead, useBulkAnalyzeLeads } from '@/lib/hooks'
import { getInitials, formatCurrency, formatTime, STAGE_LABELS, STAGE_COLORS, scoreColor } from '@/lib/utils'
import { Plus, Search, Trash2, Loader2, Upload, Download, LayoutGrid, List, Target, ChevronDown, Brain, Sparkles, RefreshCw, Webhook } from 'lucide-react'
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
}: {
  lead: any
  onStageChange: (id: string, stage: string) => void
  onContact?: (lead: any) => void
  onScore?: (lead: any) => void
  scoring?: boolean
}) {
  const deleteLead = useDeleteLead()
  const isUnscored = !lead.ai_score || lead.ai_score === 0

  return (
    <div
      className="p-3.5 rounded-2xl mb-2 group transition-all hover:-translate-y-0.5"
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
          onClick={() => { if (confirm('Delete lead?')) deleteLead.mutate(lead.id) }}
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
            onChange={e => onStageChange(lead.id, e.target.value)}
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
}: {
  lead: any
  onStageChange: (id: string, stage: string) => void
  onScore?: (lead: any) => void
  scoring?: boolean
}) {
  const deleteLead = useDeleteLead()
  const sc = STAGE_COLORS[lead.stage] ?? STAGE_COLORS.new
  const isUnscored = !lead.ai_score || lead.ai_score === 0

  return (
    <tr className="group hover:bg-green-50/40 transition-colors border-b" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
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
          onChange={e => onStageChange(lead.id, e.target.value)}
          className="text-[10px] px-2 py-1 rounded-lg outline-none cursor-pointer border"
          style={{ background: sc.bg, color: sc.text, borderColor: 'transparent' }}
        >
          {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
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
            onClick={() => onScore?.(lead)}
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
          onClick={() => { if (confirm('Delete lead?')) deleteLead.mutate(lead.id) }}
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

// ─── Main Leads Component ─────────────────────────────────────
export default function Leads() {
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('board')
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
    </div>
  )
}
