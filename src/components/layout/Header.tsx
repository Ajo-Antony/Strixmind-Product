'use client'
import { useState, useRef, useEffect } from 'react'
import { Bell, Sparkles, Menu, CheckCheck, X } from 'lucide-react'
import { useNotifications, useMarkNotificationRead } from '@/lib/hooks'

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  dashboard:     { title: 'Dashboard',       subtitle: 'Real-time business overview' },
  inbox:         { title: 'Inbox',           subtitle: 'WhatsApp conversations' },
  leads:         { title: 'Lead Pipeline',   subtitle: 'CRM kanban board' },
  tasks:         { title: 'Tasks',           subtitle: 'AI-generated and manual tasks' },
  appointments:  { title: 'Appointments',    subtitle: 'Scheduled meetings and viewings' },
  analytics:     { title: 'Analytics',       subtitle: 'Real data from your Supabase' },
  automation:    { title: 'Automation',      subtitle: 'Workflow engine' },
  agents:        { title: 'AI Agents',       subtitle: 'Build and test AI agents' },
  campaigns:     { title: 'Campaigns',       subtitle: 'Bulk WhatsApp outreach' },
  knowledge:     { title: 'Knowledge Base',  subtitle: 'RAG context for AI replies' },
  notifications: { title: 'Notifications',   subtitle: 'System alerts and updates' },
  billing:       { title: 'Billing & Plans', subtitle: 'Subscription and usage' },
  settings:      { title: 'Settings',        subtitle: 'Configuration and setup guide' },
}

function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const { data } = useNotifications(false)
  const markRead = useMarkNotificationRead()
  const items = (data ?? []).slice(0, 6)
  const unread = items.filter((n: any) => !n.read).length
  return (
    <div className="absolute right-0 top-full mt-2 w-80 rounded-3xl overflow-hidden z-50 shadow-xl"
      style={{ background: 'rgba(247,253,248,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(34,197,94,0.12)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(34,197,94,0.08)' }}>
        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Notifications {unread > 0 && (
            <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a' }}>{unread}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button onClick={() => markRead.mutate({ all_read: true })}
              className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-lg"
              style={{ background: 'rgba(34,197,94,0.08)', color: '#166534' }}>
              <CheckCheck className="w-2.5 h-2.5" /> All read
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5">
            <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>No notifications yet</div>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          {items.map((n: any) => (
            <div key={n.id}
              className="px-4 py-3 border-b hover:bg-black/[0.01] transition-all cursor-pointer"
              style={{ borderColor: 'rgba(0,0,0,0.04)', background: n.read ? 'transparent' : 'rgba(34,197,94,0.015)' }}
              onClick={() => !n.read && markRead.mutate({ id: n.id })}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{n.title}</div>
                {!n.read && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: '#22c55e' }} />}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{n.body}</div>
              <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {(() => {
                  const diff = Date.now() - new Date(n.created_at).getTime()
                  if (diff < 60_000) return 'just now'
                  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
                  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
                  return new Date(n.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="px-4 py-2.5 text-center">
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Click a notification to mark it read</span>
      </div>
    </div>
  )
}

export default function Header({
  activeTab, setSidebarOpen,
}: { activeTab: string; setSidebarOpen: (open: boolean) => void }) {
  const meta = PAGE_META[activeTab] ?? PAGE_META.dashboard
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const { data: notifs } = useNotifications(true)
  const unreadCount = (notifs ?? []).length

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    if (notifOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [notifOpen])

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-[260px] z-40 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4"
      style={{ background: 'rgba(247,253,248,0.82)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(34,197,94,0.08)' }}>
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={() => setSidebarOpen(true)}
          className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ border: '1px solid rgba(34,197,94,0.1)', background: 'rgba(255,255,255,0.7)' }}>
          <Menu className="w-5 h-5 text-emerald-700" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold truncate" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{meta.title}</h1>
          <p className="text-[11px] sm:text-xs truncate" style={{ color: 'var(--text-muted)' }}>{meta.subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
          style={{ background: 'linear-gradient(135deg,rgba(34,197,94,0.1),rgba(134,239,172,0.08))', border: '1px solid rgba(34,197,94,0.15)', color: '#166534' }}>
          <Sparkles className="w-3 h-3 text-emerald-500" />
          <span className="font-medium">AI-powered · Realtime</span>
        </div>
        <div ref={notifRef} className="relative">
          <button onClick={() => setNotifOpen(o => !o)}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
            style={{ border: '1px solid rgba(34,197,94,0.1)', background: notifOpen ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.65)' }}>
            <Bell className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                style={{ background: '#22c55e', boxShadow: '0 0 0 2px #F7FDF8' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
        </div>
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
          style={{ background: 'rgba(0,0,0,0.03)', color: 'var(--text-muted)' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
      </div>
    </header>
  )
}
