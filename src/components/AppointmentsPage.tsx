'use client'
import { useState } from 'react'
import { useAppointments, useCreateAppointment, useUpdateAppointment } from '@/lib/hooks'
import { Calendar, Clock, Plus, Loader2, CheckCircle, XCircle, Users } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  scheduled:  { bg: 'rgba(59,130,246,0.1)',  text: '#2563eb' },
  confirmed:  { bg: 'rgba(34,197,94,0.1)',   text: '#166534' },
  cancelled:  { bg: 'rgba(239,68,68,0.1)',   text: '#dc2626' },
  completed:  { bg: 'rgba(34,197,94,0.08)',  text: '#166534' },
  no_show:    { bg: 'rgba(245,158,11,0.1)',  text: '#d97706' },
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/6 ${className}`} />
}

function AddAppointmentModal({ onClose }: { onClose: () => void }) {
  const create = useCreateAppointment()
  const [form, setForm] = useState({ title: '', notes: '', scheduled_at: '', duration_minutes: '60' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit() {
    if (!form.title || !form.scheduled_at) return toast.error('Title and date/time required')
    try {
      await create.mutateAsync({ ...form, duration_minutes: parseInt(form.duration_minutes), status: 'scheduled' })
      toast.success('Appointment scheduled')
      onClose()
    } catch (err: any) { toast.error(err.message) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}>
      <div className="glass rounded-3xl p-6 w-full max-w-sm">
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Schedule Appointment</h2>
        <div className="space-y-3">
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Appointment title *"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
          <input type="datetime-local" value={form.scheduled_at} onChange={e => set('scheduled_at', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
          <select value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }}>
            {[30,45,60,90,120].map(d => <option key={d} value={d}>{d} minutes</option>)}
          </select>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Notes (optional)"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm"
            style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={submit} disabled={create.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm text-white font-medium flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}>
            {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Schedule
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Appointments() {
  const { data: appointments, isLoading } = useAppointments()
  const updateApt = useUpdateAppointment()
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('all')

  const filtered = (appointments ?? []).filter((a: any) => filter === 'all' || a.status === filter)

  const grouped = filtered.reduce((acc: Record<string, any[]>, apt: any) => {
    const day = new Date(apt.scheduled_at).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })
    if (!acc[day]) acc[day] = []
    acc[day].push(apt)
    return acc
  }, {})

  async function updateStatus(id: string, status: string) {
    try {
      await updateApt.mutateAsync({ id, status })
      toast.success(`Marked as ${status}`)
    } catch (err: any) { toast.error(err.message) }
  }

  const upcoming = (appointments ?? []).filter((a: any) => a.status === 'scheduled' && new Date(a.scheduled_at) > new Date()).length
  const today = (appointments ?? []).filter((a: any) => {
    const d = new Date(a.scheduled_at)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }).length

  return (
    <div>
      {showAdd && <AddAppointmentModal onClose={() => setShowAdd(false)} />}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {[
          { label: 'Upcoming', value: upcoming, color: '#3b82f6', icon: Calendar },
          { label: 'Today', value: today, color: '#22c55e', icon: Clock },
          { label: 'Total', value: (appointments ?? []).length, color: '#8b5cf6', icon: Users },
        ].map(s => (
          <div key={s.label} className="glass rounded-2xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>{s.value}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="glass rounded-2xl p-3 mb-4 flex items-center gap-3">
        <div className="flex gap-1">
          {['all','scheduled','confirmed','completed','cancelled'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className="px-3 py-1.5 rounded-xl text-[11px] font-medium capitalize transition-all"
              style={{ background: filter === s ? 'rgba(34,197,94,0.12)' : 'transparent', color: filter === s ? '#166534' : 'var(--text-muted)' }}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)} className="ml-auto flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white"
          style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}>
          <Plus className="w-3.5 h-3.5" /> Schedule
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{Array(4).fill(0).map((_,i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="glass rounded-3xl p-16 text-center">
          <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>No appointments</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Schedule your first appointment to get started</div>
        </div>
      ) : (Object.entries(grouped) as [string, any[]][]).map(([day, apts]) => (
        <div key={day} className="mb-5">
          <div className="text-xs font-semibold mb-2 px-1" style={{ color: 'var(--text-muted)' }}>{day}</div>
          <div className="space-y-2">
            {apts.map((apt: any) => {
              const sc = STATUS_COLORS[apt.status] ?? STATUS_COLORS.scheduled
              const time = new Date(apt.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
              const isPast = new Date(apt.scheduled_at) < new Date()
              return (
                <div key={apt.id} className="glass rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-14 text-center flex-shrink-0">
                    <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{time}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{apt.duration_minutes}min</div>
                  </div>
                  <div className="w-px h-10 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.08)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{apt.title}</div>
                    {(apt.lead?.name || apt.contact?.name) && (
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {apt.lead?.name ?? apt.contact?.name} · {apt.lead?.phone ?? apt.contact?.phone}
                      </div>
                    )}
                    {apt.notes && <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{apt.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: sc.bg, color: sc.text }}>
                      {apt.status}
                    </span>
                    {apt.status === 'scheduled' && (
                      <>
                        <button onClick={() => updateStatus(apt.id, 'confirmed')}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-emerald-50 transition-colors" title="Confirm">
                          <CheckCircle className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                        </button>
                        <button onClick={() => updateStatus(apt.id, 'cancelled')}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors" title="Cancel">
                          <XCircle className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />
                        </button>
                      </>
                    )}
                    {apt.status === 'confirmed' && isPast && (
                      <>
                        <button onClick={() => updateStatus(apt.id, 'completed')}
                          className="text-[10px] px-2 py-1 rounded-lg font-medium" style={{ background: 'rgba(34,197,94,0.1)', color: '#166534' }}>
                          Complete
                        </button>
                        <button onClick={() => updateStatus(apt.id, 'no_show')}
                          className="text-[10px] px-2 py-1 rounded-lg font-medium" style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
                          No Show
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
