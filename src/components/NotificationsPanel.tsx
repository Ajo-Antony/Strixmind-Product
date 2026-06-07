'use client'
import { useState } from 'react'
import { useNotifications, useMarkNotificationRead } from '@/lib/hooks'
import { Bell, Check, CheckCheck, Loader2, AlertCircle, TrendingUp, Calendar, UserCheck, Bot, Zap, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/6 ${className}`} />
}

const TYPE_META: Record<string, { icon: any; color: string; bg: string }> = {
  task_due:                 { icon: CheckCheck,  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  lead_assigned:            { icon: UserCheck,   color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  campaign_finished:        { icon: TrendingUp,  color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  appointment_reminder:     { icon: Calendar,    color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
  ai_error:                 { icon: AlertCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  handoff_assigned:         { icon: UserCheck,   color: '#06b6d4', bg: 'rgba(6,182,212,0.08)' },
  whatsapp_delivery_failed: { icon: AlertCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  high_score_lead:          { icon: TrendingUp,  color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
  budget_alert:             { icon: DollarSign,  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  usage_limit:              { icon: Zap,         color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
}
const DEFAULT_META = { icon: Bell, color: '#64748b', bg: 'rgba(100,116,139,0.08)' }

function formatTime(ts: string) {
  const d = new Date(ts)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

export default function NotificationsPanel() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const { data: notifications, isLoading, isError } = useNotifications(filter === 'unread')
  const markRead = useMarkNotificationRead()

  // Gracefully handle missing notifications table
  const notificationList = isError ? [] : (notifications ?? [])
  const unreadCount = notificationList.filter((n: any) => !n.read).length

  async function markAll() {
    try {
      await markRead.mutateAsync({ all_read: true })
      toast.success('All notifications marked as read')
    } catch { toast.error('Failed to mark as read') }
  }

  async function markOne(id: string) {
    await markRead.mutateAsync({ id }).catch(() => {})
  }

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="glass rounded-3xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)' }}>
            <Bell className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</div>
            {unreadCount > 0 && (
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{unreadCount} unread</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter tabs */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            {(['all', 'unread'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-3 py-1.5 text-xs font-medium capitalize transition-all"
                style={{ background: filter === f ? 'rgba(34,197,94,0.1)' : 'transparent', color: filter === f ? '#166534' : 'var(--text-muted)' }}>
                {f}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAll} disabled={markRead.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{ background: 'rgba(34,197,94,0.08)', color: '#166534' }}>
              {markRead.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="glass rounded-3xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : notificationList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="w-8 h-8 mb-3 opacity-20" />
            <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No notifications</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {isError ? 'Notifications table not set up yet — run the missing tables migration' : filter === 'unread' ? 'All caught up!' : 'Notifications from AI events will appear here'}
            </div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
            {notificationList.map((n: any) => {
              const meta = TYPE_META[n.type] ?? DEFAULT_META
              const Icon = meta.icon
              return (
                <div key={n.id}
                  className="flex items-start gap-3 px-4 py-3.5 transition-all hover:bg-black/[0.015] cursor-pointer"
                  style={{ background: n.read ? 'transparent' : 'rgba(34,197,94,0.02)' }}
                  onClick={() => !n.read && markOne(n.id)}>
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: meta.bg }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{n.title}</div>
                      <div className="text-[10px] flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>{formatTime(n.created_at)}</div>
                    </div>
                    <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{n.body}</div>
                    {n.type && (
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                        style={{ background: meta.bg, color: meta.color }}>
                        {n.type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  {/* Unread dot */}
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: '#22c55e' }} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
