'use client'
import { useState, Component, type ReactNode } from 'react'

import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

import Dashboard from '@/components/Dashboard'
import Inbox from '@/components/Inbox'
import Leads from '@/components/Leads'
import Tasks from '@/components/Tasks'
import Analytics from '@/components/Analytics'
import Automation from '@/components/Automation'
import AgentsPage from '@/components/AgentsPage'
import AppointmentsPage from '@/components/AppointmentsPage'
import SettingsPage from '@/components/SettingsPage'
import CampaignsPage from '@/components/CampaignsPage'
import KnowledgeBase from '@/components/KnowledgeBase'
import NotificationsPanel from '@/components/NotificationsPanel'
import BillingPage from '@/components/BillingPage'

// ─── Error Boundary ────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: any) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="glass rounded-3xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Something went wrong</div>
          <div className="text-xs mb-4 max-w-sm" style={{ color: 'var(--text-muted)' }}>{this.state.error.message}</div>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 rounded-xl text-xs font-medium text-white"
            style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Page registry ─────────────────────────────────────────────
const PAGES: Record<string, React.ComponentType> = {
  dashboard:     Dashboard,
  inbox:         Inbox,
  leads:         Leads,
  tasks:         Tasks,
  appointments:  AppointmentsPage,
  analytics:     Analytics,
  automation:    Automation,
  agents:        AgentsPage,
  campaigns:     CampaignsPage,
  knowledge:     KnowledgeBase,
  notifications: NotificationsPanel,
  billing:       BillingPage,
  settings:      SettingsPage,
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const Page = PAGES[activeTab] ?? Dashboard

  return (
    <div className="min-h-screen relative z-10 bg-[#f7fdf8] overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab); setSidebarOpen(false) }}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      <Header activeTab={activeTab} setSidebarOpen={setSidebarOpen} />
      <main className="min-h-screen pt-20 pb-8 px-4 sm:px-6 lg:px-8 transition-all duration-300 lg:ml-[260px]">
        <div className="max-w-7xl mx-auto animate-slide-up w-full min-w-0">
          <ErrorBoundary key={activeTab}>
            <Page />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
