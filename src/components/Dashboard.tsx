'use client'
import { useAnalytics, useAppointments } from '@/lib/hooks'
import { formatCurrency, getInitials, scoreColor, STAGE_LABELS, STAGE_COLORS } from '@/lib/utils'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, BarChart, Bar } from 'recharts'
import { TrendingUp, MessageSquare, Users, CheckSquare, Brain, Clock, Zap, Target } from 'lucide-react'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/5 ${className}`} />
}

function StatCard({ label, value, sub, icon: Icon, color, loading }: {
  label: string; value: string; sub: string; icon: any; color: string; loading?: boolean
}) {
  return (
    <div className="glass rounded-3xl p-5 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
      <div className="absolute top-0 right-0 w-28 h-28 rounded-full opacity-20 blur-2xl pointer-events-none"
        style={{ background: color, transform: 'translate(35%,-35%)' }} />
      <div className="w-9 h-9 rounded-2xl flex items-center justify-center mb-4 flex-shrink-0"
        style={{ background: `${color}18` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      {loading ? (
        <>
          <Skeleton className="h-7 w-20 mb-1" />
          <Skeleton className="h-3 w-24 mb-1" />
          <Skeleton className="h-3 w-16" />
        </>
      ) : (
        <>
          <div className="text-2xl font-bold mb-0.5" style={{ color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>{value}</div>
          <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</div>
        </>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { data: analytics, isLoading } = useAnalytics()

  const stats = [
    { label: 'Total Revenue', value: formatCurrency(analytics?.totalRevenue), sub: `${analytics?.conversionRate ?? 0}% conversion rate`, icon: TrendingUp, color: '#22c55e' },
    { label: 'Active Conversations', value: String(analytics?.activeConversations ?? 0), sub: 'Realtime from WhatsApp', icon: MessageSquare, color: '#3b82f6' },
    { label: 'Leads in Pipeline', value: String(analytics?.totalLeads ?? 0), sub: `+${analytics?.newLeadsThisWeek ?? 0} this week`, icon: Users, color: '#8b5cf6' },
    { label: 'Open Tasks', value: String(analytics?.openTasks ?? 0), sub: `${analytics?.aiTasksGenerated ?? 0} AI-generated`, icon: CheckSquare, color: '#f59e0b' },
  ]

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => <StatCard key={s.label} {...s} loading={isLoading} />)}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <div className="glass rounded-3xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Revenue Trend</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Last 6 months · from converted leads</div>
            </div>
            {!isLoading && (
              <div className="text-xl font-bold" style={{ color: '#22c55e', letterSpacing: '-0.04em' }}>
                {formatCurrency(analytics?.totalRevenue)}
              </div>
            )}
          </div>
          {isLoading ? <Skeleton className="h-36 w-full" /> : (
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics?.revenueChart ?? []}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8aab98' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                  <Area type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* AI Health */}
        <div className="rounded-3xl p-5 flex flex-col"
          style={{ background: 'linear-gradient(135deg, #0f1f14 0%, #14532d 100%)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.2)' }}>
              <Brain className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-sm font-semibold text-emerald-100">AI Engine</span>
            <div className="ml-auto status-online" />
          </div>
          <div className="space-y-3 flex-1">
            {isLoading ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-5 w-full opacity-30" />) : [
              { label: 'Requests (month)', value: String(analytics?.ai?.requestCount ?? 0) },
              { label: 'Success Rate', value: `${analytics?.ai?.successRate ?? 100}%` },
              { label: 'Avg Latency', value: `${analytics?.ai?.avgLatency ?? 0}ms` },
              { label: 'Total Cost', value: `$${analytics?.ai?.totalCost ?? '0.00'}` },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-xs text-emerald-300/70">{item.label}</span>
                <span className="text-sm font-semibold text-emerald-300">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-800/40">
            <div className="text-[11px] text-emerald-400/60">Tokens used this month</div>
            <div className="text-sm font-bold text-emerald-300 mt-0.5">
              {((analytics?.ai?.totalTokens ?? 0) / 1000).toFixed(1)}K
            </div>
          </div>
        </div>
      </div>

      {/* Lead funnel + Top leads + Top tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lead funnel */}
        <div className="glass rounded-3xl p-5">
          <div className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Lead Pipeline</div>
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.leadsByStage ?? []} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#8aab98' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#22c55e" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top leads */}
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Hot Leads</div>
            <Target className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="space-y-3">
            {isLoading ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />) :
              (analytics?.topLeads ?? []).map((lead: any) => (
                <div key={lead.name} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', color: '#166534' }}>
                    {getInitials(lead.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{lead.name}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {Object.entries(STAGE_COLORS).find(([k]) => k === lead.stage)?.[0] ? STAGE_LABELS[lead.stage] : lead.stage}
                    </div>
                  </div>
                  <div className="text-sm font-bold" style={{ color: scoreColor(lead.ai_score) }}>{lead.ai_score}</div>
                </div>
              ))}
            {!isLoading && !(analytics?.topLeads?.length) && (
              <div className="text-center py-6 text-xs" style={{ color: 'var(--text-muted)' }}>
                No leads yet — they'll appear when WhatsApp messages arrive
              </div>
            )}
          </div>
        </div>

        {/* Upcoming appointments */}
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Upcoming</div>
            <Clock className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </div>
          <UpcomingAppointments />
        </div>
      </div>
    </div>
  )
}

function UpcomingAppointments() {
  const { data, isLoading } = useAppointments(true)
  if (isLoading) return <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
  if (!data?.length) return (
    <div className="text-center py-6 text-xs" style={{ color: 'var(--text-muted)' }}>No upcoming appointments</div>
  )
  return (
    <div className="space-y-2">
      {data.slice(0, 4).map((apt: any) => (
        <div key={apt.id} className="p-3 rounded-2xl" style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.08)' }}>
          <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{apt.title}</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {new Date(apt.scheduled_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ))}
    </div>
  )
}