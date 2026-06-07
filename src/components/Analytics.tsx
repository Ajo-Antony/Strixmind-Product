'use client'
import { useAnalytics } from '@/lib/hooks'
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { formatCurrency, STAGE_LABELS } from '@/lib/utils'
import { TrendingUp, Users, MessageSquare, Brain, Clock, Target, Zap, DollarSign } from 'lucide-react'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/6 ${className}`} />
}

function KPI({ label, value, sub, icon: Icon, color, loading }: any) {
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        {loading ? <><Skeleton className="h-6 w-16 mb-1" /><Skeleton className="h-3 w-20" /></> : (
          <>
            <div className="text-xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>{value}</div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sub}</div>
          </>
        )}
      </div>
    </div>
  )
}

export default function Analytics() {
  const { data: a, isLoading } = useAnalytics()

  const kpis = [
    { label: 'Total Revenue', value: formatCurrency(a?.totalRevenue), sub: 'from converted leads', icon: DollarSign, color: '#22c55e' },
    { label: 'Conversion Rate', value: `${a?.conversionRate ?? 0}%`, sub: `${a?.convertedLeads ?? 0} converted`, icon: Target, color: '#22c55e' },
    { label: 'Total Leads', value: String(a?.totalLeads ?? 0), sub: `+${a?.newLeadsThisWeek ?? 0} this week`, icon: Users, color: '#3b82f6' },
    { label: 'Active Conversations', value: String(a?.activeConversations ?? 0), sub: 'open + waiting', icon: MessageSquare, color: '#8b5cf6' },
    { label: 'Open Tasks', value: String(a?.openTasks ?? 0), sub: `${a?.aiTasksGenerated ?? 0} AI-generated`, icon: Zap, color: '#f59e0b' },
    { label: 'AI Requests', value: String(a?.ai?.requestCount ?? 0), sub: `${a?.ai?.successRate ?? 100}% success`, icon: Brain, color: '#22c55e' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {kpis.map(k => <KPI key={k.label} {...k} loading={isLoading} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-3xl p-5">
          <div className="mb-3">
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Revenue Trend</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Last 6 months · converted leads budget</div>
          </div>
          {isLoading ? <Skeleton className="h-44 w-full" /> : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={a?.revenueChart ?? []}>
                  <defs>
                    <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8aab98' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                  <Area type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} fill="url(#aGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="glass rounded-3xl p-5">
          <div className="mb-3">
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Lead Pipeline Funnel</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Leads by stage</div>
          </div>
          {isLoading ? <Skeleton className="h-44 w-full" /> : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(a?.leadsByStage ?? []).map((s: any) => ({ ...s, stage: STAGE_LABELS[s.stage] ?? s.stage }))} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#8aab98' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: '#4a6355' }} axisLine={false} tickLine={false} width={72} />
                  <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#22c55e" radius={[0,6,6,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-3xl p-5">
          <div className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>AI Performance</div>
          {isLoading ? <div className="space-y-3">{Array(4).fill(0).map((_,i)=><Skeleton key={i} className="h-10 w-full" />)}</div> : (
            <div className="space-y-3">
              {[
                { label: 'Total Requests', value: String(a?.ai?.requestCount ?? 0), bar: null },
                { label: 'Success Rate', value: `${a?.ai?.successRate ?? 100}%`, bar: a?.ai?.successRate ?? 100 },
                { label: 'Avg Latency', value: `${a?.ai?.avgLatency ?? 0}ms`, bar: Math.min(100, (a?.ai?.avgLatency ?? 0) / 50) },
                { label: 'Tokens Used', value: `${((a?.ai?.totalTokens ?? 0)/1000).toFixed(1)}K`, bar: null },
                { label: 'Total Cost', value: `$${a?.ai?.totalCost ?? '0.0000'}`, bar: null },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs w-28 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                  {item.bar != null && (
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
                      <div className="h-full rounded-full" style={{ width: `${item.bar}%`, background: 'linear-gradient(90deg,#22c55e,#4ade80)' }} />
                    </div>
                  )}
                  <span className="text-xs font-bold ml-auto" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-3xl p-5">
          <div className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Top Leads by Score</div>
          {isLoading ? <div className="space-y-3">{Array(5).fill(0).map((_,i)=><Skeleton key={i} className="h-10 w-full" />)}</div> : (
            <div className="space-y-2.5">
              {(a?.topLeads ?? []).length === 0 ? (
                <div className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>No leads yet — data will appear as conversations come in</div>
              ) : (a?.topLeads ?? []).map((lead: any, i: number) => (
                <div key={lead.name} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'rgba(34,197,94,0.04)' }}>
                  <span className="text-[11px] font-bold w-5 text-center" style={{ color: 'var(--text-muted)' }}>#{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{lead.name}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{STAGE_LABELS[lead.stage] ?? lead.stage}</div>
                  </div>
                  {lead.budget && <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(lead.budget)}</span>}
                  <span className="text-sm font-bold" style={{ color: '#22c55e' }}>{lead.ai_score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
