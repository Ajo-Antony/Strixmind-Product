'use client'
import { useState } from 'react'
import { useCampaigns, useCreateCampaign, useUpdateCampaign, useDeleteCampaign, useCampaignMetrics, useComputeCampaignMetrics } from '@/lib/hooks'
import { Megaphone, Plus, Trash2, Loader2, BarChart2, Play, Pause, X, TrendingUp, Users, MessageSquare, Target, Sparkles, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/6 ${className}`} />
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft:     { bg: 'rgba(100,116,139,0.1)', color: '#64748b' },
  active:    { bg: 'rgba(34,197,94,0.1)',   color: '#16a34a' },
  paused:    { bg: 'rgba(245,158,11,0.1)',  color: '#d97706' },
  completed: { bg: 'rgba(59,130,246,0.1)',  color: '#2563eb' },
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="glass rounded-2xl p-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div>
        <div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</div>
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
      </div>
    </div>
  )
}

function MetricsPanel({ campaignId }: { campaignId: string }) {
  const { data, isLoading } = useCampaignMetrics(campaignId)
  const compute = useComputeCampaignMetrics()

  const m = data?.data ?? data

  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Analytics</div>
        <button onClick={() => compute.mutateAsync(campaignId).then(() => toast.success('Metrics refreshed')).catch(() => {})}
          disabled={compute.isPending}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-all"
          style={{ background: 'rgba(34,197,94,0.06)', color: '#166534' }}>
          {compute.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
          Refresh
        </button>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
      ) : m ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Open rate', value: `${(m.open_rate ?? 0).toFixed(1)}%`, color: '#3b82f6' },
              { label: 'Reply rate', value: `${(m.reply_rate ?? 0).toFixed(1)}%`, color: '#8b5cf6' },
              { label: 'Conversion', value: `${(m.conversion_rate ?? 0).toFixed(1)}%`, color: '#22c55e' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-2 text-center" style={{ background: `${s.color}0a`, border: `1px solid ${s.color}18` }}>
                <div className="text-sm font-semibold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {m.ai_optimisation_suggestion && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.1)' }}>
              <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: '#8b5cf6' }} />
              <div className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{m.ai_optimisation_suggestion}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>No metrics yet — click Refresh to compute</div>
      )}
    </div>
  )
}

export default function CampaignsPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [form, setForm] = useState({ name: '', description: '' })

  const { data: campaigns, isLoading } = useCampaigns()
  const createCampaign = useCreateCampaign()
  const updateCampaign = useUpdateCampaign()
  const deleteCampaign = useDeleteCampaign()

  const all: any[] = campaigns ?? []
  const filtered = statusFilter === 'all' ? all : all.filter((c: any) => c.status === statusFilter)

  const stats = {
    total: all.length,
    active: all.filter((c: any) => c.status === 'active').length,
    leads: all.reduce((s: number, c: any) => s + (c.metrics?.total_leads ?? 0), 0),
    avgConversion: all.length ? (all.reduce((s: number, c: any) => s + (c.conversion_rate ?? 0), 0) / all.length).toFixed(1) : '0',
  }

  async function handleCreate() {
    if (!form.name.trim()) return toast.error('Campaign name is required')
    try {
      await createCampaign.mutateAsync({ name: form.name, description: form.description, status: 'draft' })
      setForm({ name: '', description: '' })
      setShowAdd(false)
      toast.success('Campaign created')
    } catch (err: any) { toast.error(err.message ?? 'Failed to create campaign') }
  }

  async function toggleStatus(c: any) {
    const next = c.status === 'active' ? 'paused' : c.status === 'paused' ? 'active' : c.status === 'draft' ? 'active' : c.status
    try {
      await updateCampaign.mutateAsync({ id: c.id, status: next })
      toast.success(`Campaign ${next}`)
    } catch { toast.error('Failed to update status') }
  }

  async function handleDelete(c: any) {
    if (!confirm(`Delete campaign "${c.name}"?`)) return
    try {
      await deleteCampaign.mutateAsync(c.id)
      toast.success('Campaign deleted')
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass rounded-3xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)' }}>
            <Megaphone className="w-4 h-4" style={{ color: '#8b5cf6' }} />
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Campaigns</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Bulk WhatsApp outreach</div>
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)' }}>
          <Plus className="w-3.5 h-3.5" />
          New campaign
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total campaigns" value={stats.total} icon={Megaphone} color="#8b5cf6" />
        <StatCard label="Active now"       value={stats.active} icon={Play}      color="#22c55e" />
        <StatCard label="Total leads"      value={stats.leads}  icon={Users}     color="#3b82f6" />
        <StatCard label="Avg conversion"   value={`${stats.avgConversion}%`} icon={Target} color="#f59e0b" />
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="glass rounded-3xl p-5 space-y-3" style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New Campaign</div>
            <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg hover:bg-black/5">
              <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Campaign name (e.g. Diwali Sale 2025)"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Optional description of campaign goal…"
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={createCampaign.isPending || !form.name}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)' }}>
              {createCampaign.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create campaign
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass rounded-3xl px-4 py-2 flex gap-1">
        {['all', 'draft', 'active', 'paused', 'completed'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all"
            style={{
              background: statusFilter === s ? (STATUS_COLORS[s]?.bg ?? 'rgba(34,197,94,0.1)') : 'transparent',
              color: statusFilter === s ? (STATUS_COLORS[s]?.color ?? '#166534') : 'var(--text-muted)',
            }}>
            {s}
          </button>
        ))}
      </div>

      {/* Campaign list */}
      <div className="glass rounded-3xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Megaphone className="w-8 h-8 mb-3 opacity-20" />
            <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              {statusFilter === 'all' ? 'No campaigns yet' : `No ${statusFilter} campaigns`}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Create a campaign to run bulk WhatsApp outreach
            </div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
            {filtered.map((c: any) => {
              const sc = STATUS_COLORS[c.status] ?? STATUS_COLORS.draft
              const isExpanded = expandedId === c.id
              return (
                <div key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={sc}>{c.status}</span>
                      </div>
                      {c.description && (
                        <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{c.description}</div>
                      )}
                      <div className="flex gap-3">
                        {[
                          { label: 'Open', value: `${(c.open_rate ?? 0).toFixed(1)}%`, color: '#3b82f6' },
                          { label: 'Reply', value: `${(c.reply_rate ?? 0).toFixed(1)}%`, color: '#8b5cf6' },
                          { label: 'Conv.', value: `${(c.conversion_rate ?? 0).toFixed(1)}%`, color: '#22c55e' },
                        ].map(s => (
                          <div key={s.label} className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                            <span className="text-[10px] font-semibold" style={{ color: s.color }}>{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {(c.status === 'active' || c.status === 'paused' || c.status === 'draft') && (
                        <button onClick={() => toggleStatus(c)}
                          className="p-1.5 rounded-xl transition-colors"
                          style={{ background: c.status === 'active' ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)' }}
                          title={c.status === 'active' ? 'Pause' : 'Activate'}>
                          {c.status === 'active'
                            ? <Pause className="w-3.5 h-3.5" style={{ color: '#d97706' }} />
                            : <Play className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />}
                        </button>
                      )}
                      <button onClick={() => setExpandedId(isExpanded ? null : c.id)}
                        className="p-1.5 rounded-xl transition-colors hover:bg-black/5"
                        title="View analytics">
                        <BarChart2 className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                      </button>
                      <button onClick={() => handleDelete(c)}
                        className="p-1.5 rounded-xl transition-colors hover:bg-red-50"
                        title="Delete">
                        <Trash2 className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />
                      </button>
                    </div>
                  </div>
                  {isExpanded && <MetricsPanel campaignId={c.id} />}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
