'use client'
import { useState } from 'react'
import { useCampaigns, useCreateCampaign, useUpdateCampaign, useDeleteCampaign } from '@/lib/hooks'
import { Plus, Edit2, Trash2, Loader2, Target, TrendingUp, Users, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { formatTime } from '@/lib/utils'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:     { bg: 'rgba(148,163,184,0.15)', text: '#64748b' },
  active:    { bg: 'rgba(34,197,94,0.12)',   text: '#16a34a' },
  paused:    { bg: 'rgba(245,158,11,0.12)',  text: '#d97706' },
  completed: { bg: 'rgba(59,130,246,0.12)',  text: '#2563eb' },
}

const STATUSES = ['draft', 'active', 'paused', 'completed']

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/5 ${className}`} />
}

function CampaignModal({ campaign, onClose }: { campaign?: any; onClose: () => void }) {
  const createCampaign = useCreateCampaign()
  const updateCampaign = useUpdateCampaign()
  const [form, setForm] = useState({
    name: campaign?.name ?? '',
    description: campaign?.description ?? '',
    status: campaign?.status ?? 'draft',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const isPending = createCampaign.isPending || updateCampaign.isPending

  async function handleSubmit() {
    if (!form.name.trim()) return toast.error('Campaign name is required')
    try {
      if (campaign) {
        await updateCampaign.mutateAsync({ id: campaign.id, ...form })
        toast.success('Campaign updated')
      } else {
        await createCampaign.mutateAsync(form)
        toast.success('Campaign created')
      }
      onClose()
    } catch (err: any) { toast.error(err.message) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}>
      <div className="glass rounded-3xl p-6 w-full max-w-md" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          {campaign ? 'Edit Campaign' : 'New Campaign'}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Campaign Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Summer Outreach 2025"
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
              placeholder="Optional campaign description…"
              className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }}>
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm"
            style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={isPending}
            className="flex-1 py-2.5 rounded-xl text-sm text-white font-medium flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#166534,#22c55e)', opacity: isPending ? 0.7 : 1 }}>
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />} Save Campaign
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CampaignsSection() {
  const { data: campaigns, isLoading } = useCampaigns()
  const deleteCampaign = useDeleteCampaign()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete campaign "${name}"? This cannot be undone.`)) return
    try {
      await deleteCampaign.mutateAsync(id)
      toast.success('Campaign deleted')
    } catch (err: any) { toast.error(err.message) }
  }

  const totalLeads = (campaigns ?? []).reduce((sum: number, c: any) => sum + (c.lead_count ?? 0), 0)
  const totalConverted = (campaigns ?? []).reduce((sum: number, c: any) => sum + (c.converted_count ?? 0), 0)
  const activeCampaigns = (campaigns ?? []).filter((c: any) => c.status === 'active').length

  return (
    <div className="space-y-5">
      {(showModal || editing) && (
        <CampaignModal campaign={editing} onClose={() => { setShowModal(false); setEditing(null) }} />
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Campaigns', value: (campaigns ?? []).length, icon: Target, color: '#8b5cf6' },
          { label: 'Active', value: activeCampaigns, icon: TrendingUp, color: '#22c55e' },
          { label: 'Converted', value: totalConverted, icon: CheckCircle, color: '#3b82f6' },
        ].map(s => (
          <div key={s.label} className="glass rounded-2xl p-4"
            style={{ border: `1px solid ${s.color}18` }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
              style={{ background: `${s.color}15` }}>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <div className="text-xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
              {isLoading ? '—' : s.value}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          All Campaigns ({(campaigns ?? []).length})
        </h3>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white"
          style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}>
          <Plus className="w-3.5 h-3.5" /> New Campaign
        </button>
      </div>

      {/* Campaign Cards */}
      {isLoading ? (
        <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (campaigns ?? []).length === 0 ? (
        <div className="text-center py-16 rounded-2xl"
          style={{ background: 'rgba(0,0,0,0.02)', border: '1px dashed rgba(0,0,0,0.08)' }}>
          <Target className="w-10 h-10 mx-auto mb-3" style={{ color: '#94a3b8' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No campaigns yet</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Create your first campaign to start tracking lead outreach</p>
          <button onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-xl text-xs text-white inline-flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}>
            <Plus className="w-3 h-3" /> Create Campaign
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {(campaigns ?? []).map((c: any) => {
            const sc = STATUS_COLORS[c.status] ?? STATUS_COLORS.draft
            const rate = c.lead_count > 0 ? Math.round((c.converted_count / c.lead_count) * 100) : 0
            return (
              <div key={c.id} className="glass rounded-2xl p-4 group"
                style={{ border: '1px solid rgba(0,0,0,0.05)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{ background: sc.bg, color: sc.text }}>
                        {c.status}
                      </span>
                    </div>
                    {c.description && (
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{c.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3 flex-shrink-0">
                    <button onClick={() => setEditing(c)}
                      className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />
                    </button>
                    <button onClick={() => handleDelete(c.id, c.name)}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Leads', value: c.lead_count ?? 0 },
                    { label: 'Converted', value: c.converted_count ?? 0 },
                    { label: 'Rate', value: `${rate}%` },
                  ].map(s => (
                    <div key={s.label} className="text-center py-2 rounded-xl"
                      style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  Created {formatTime(c.created_at)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}