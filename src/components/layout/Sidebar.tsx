'use client'
import {
  MessageSquare, LayoutDashboard, Users, CheckSquare, BarChart3, Settings,
  Zap, Brain, Calendar, Megaphone, X, BookOpen, Bell, CreditCard,
} from 'lucide-react'
import { useNotifications } from '@/lib/hooks'
import { useConversations } from '@/lib/hooks'
import { useTasks } from '@/lib/hooks'

const NAV_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { id: 'dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
      { id: 'inbox',      label: 'Inbox',        icon: MessageSquare,  badgeKey: 'inbox' },
      { id: 'leads',      label: 'Leads',        icon: Users },
      { id: 'tasks',      label: 'Tasks',        icon: CheckSquare,    badgeKey: 'tasks' },
      { id: 'appointments', label: 'Appointments', icon: Calendar },
    ],
  },
  {
    label: 'Growth',
    items: [
      { id: 'campaigns',  label: 'Campaigns',    icon: Megaphone },
      { id: 'analytics',  label: 'Analytics',    icon: BarChart3 },
      { id: 'automation', label: 'Automation',   icon: Zap },
    ],
  },
  {
    label: 'AI & Content',
    items: [
      { id: 'agents',     label: 'AI Agents',    icon: Brain },
      { id: 'knowledge',  label: 'Knowledge',    icon: BookOpen },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'notifications', label: 'Notifications', icon: Bell, badgeKey: 'notifications' },
      { id: 'billing',    label: 'Billing',      icon: CreditCard },
      { id: 'settings',   label: 'Settings',     icon: Settings },
    ],
  },
]

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export default function Sidebar({ activeTab, onTabChange, sidebarOpen, setSidebarOpen }: SidebarProps) {
  // Live badge counts
  const { data: convs } = useConversations('open')
  const { data: tasks } = useTasks('pending')
  const { data: notifs } = useNotifications(true)

  const badges: Record<string, number> = {
    inbox: (convs ?? []).filter((c: any) => c.unread_count > 0).length,
    tasks: (tasks ?? []).length,
    notifications: (notifs ?? []).length,
  }

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`fixed left-0 top-0 h-full flex flex-col z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: '260px', background: 'rgba(255,255,255,0.68)', backdropFilter: 'blur(24px) saturate(200%)', WebkitBackdropFilter: 'blur(24px) saturate(200%)', borderRight: '1px solid rgba(34,197,94,0.1)', boxShadow: '4px 0 32px rgba(0,0,0,0.04)' }}>
        {/* Logo */}
        <div className="px-5 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#166534,#22c55e)', boxShadow: '0 4px 12px rgba(34,197,94,0.35)' }}>
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>StrixMind</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>AI Business OS</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 overflow-y-auto space-y-3 pb-2">
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              <div className="text-[10px] font-medium px-3 py-1.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map(({ id, label, icon: Icon, badgeKey }) => {
                  const isActive = activeTab === id
                  const badge = badgeKey ? (badges[badgeKey] ?? 0) : 0
                  return (
                    <button key={id} onClick={() => { onTabChange(id); setSidebarOpen(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm group"
                      style={{ background: isActive ? 'rgba(34,197,94,0.1)' : 'transparent', color: isActive ? '#166534' : 'var(--text-secondary)' }}>
                      <Icon className="w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110"
                        style={{ color: isActive ? '#22c55e' : 'currentColor' }} />
                      <span className={`truncate ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
                      {badge > 0 && (
                        <span className="ml-auto text-[10px] min-w-5 h-5 px-1 rounded-full flex items-center justify-center font-bold flex-shrink-0"
                          style={{ background: isActive ? '#22c55e' : 'rgba(34,197,94,0.15)', color: isActive ? 'white' : '#166534' }}>
                          {badge > 9 ? '9+' : badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* AI status */}
        <div className="mx-3 mb-3 px-4 py-3 rounded-2xl" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.1)' }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="status-online" />
            <span className="text-xs font-medium" style={{ color: '#166534' }}>AI Engine Active</span>
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Provider-agnostic routing</div>
        </div>

        {/* User */}
        <div className="px-3 py-3 border-t" style={{ borderColor: 'rgba(34,197,94,0.08)' }}>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', color: '#166534' }}>SM</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>Admin</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>StrixMind</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
