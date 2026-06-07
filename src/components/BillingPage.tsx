'use client'
import { useUsageLimits, useCreateCheckout } from '@/lib/hooks'
import { CreditCard, Zap, MessageSquare, Users, Bot, TrendingUp, CheckCircle, Lock, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/6 ${className}`} />
}

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '₹2,999',
    period: '/month',
    color: '#64748b',
    features: ['500 AI messages/month', '1 AI agent', '100 leads', '1 campaign', '5 workflows', 'Email support'],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '₹7,999',
    period: '/month',
    color: '#22c55e',
    highlight: true,
    features: ['2,000 AI messages/month', '3 AI agents', '1,000 leads', '10 campaigns', '20 workflows', 'WhatsApp support', 'Campaign analytics', 'Knowledge base (50 docs)'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₹19,999',
    period: '/month',
    color: '#8b5cf6',
    features: ['10,000 AI messages/month', '10 AI agents', 'Unlimited leads', 'Unlimited campaigns', 'Unlimited workflows', 'Priority support', 'Unlimited knowledge docs', 'AI cost dashboard', 'Custom integrations'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    color: '#f59e0b',
    features: ['Unlimited everything', 'Dedicated infrastructure', 'Custom AI fine-tuning', 'SLA guarantee', '24/7 phone support', 'On-premise option'],
  },
]

function UsageBar({ label, used, limit, icon: Icon, color }: { label: string; used: number; limit: number; icon: any; color: string }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const isHigh = pct >= 80
  return (
    <div className="p-3 rounded-2xl" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" style={{ color }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        </div>
        <span className="text-xs font-semibold" style={{ color: isHigh ? '#ef4444' : 'var(--text-primary)' }}>
          {used.toLocaleString()} / {limit > 0 ? limit.toLocaleString() : '∞'}
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
        <div className="h-full rounded-full transition-all" style={{
          width: `${pct}%`,
          background: isHigh ? '#ef4444' : color
        }} />
      </div>
      <div className="text-[10px] mt-1" style={{ color: isHigh ? '#ef4444' : 'var(--text-muted)' }}>{pct}% used</div>
    </div>
  )
}

export default function BillingPage() {
  const ORG_ID = '00000000-0000-0000-0000-000000000001'
  const { data: usageData, isLoading } = useUsageLimits(ORG_ID)
  const checkout = useCreateCheckout()

  const usage = usageData?.data ?? usageData
  const currentPlan = usage?.plan ?? 'starter'

  async function handleUpgrade(planId: string) {
    if (planId === 'enterprise') {
      window.open('mailto:sales@strixmind.ai?subject=Enterprise enquiry', '_blank')
      return
    }
    try {
      const res = await checkout.mutateAsync({ org_id: ORG_ID, plan_id: planId })
      const url = res?.data?.checkout_url ?? res?.checkout_url
      if (url) window.location.href = url
      else toast.error('Could not create checkout session')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to start checkout')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass rounded-3xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
            <CreditCard className="w-4 h-4" style={{ color: '#d97706' }} />
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Billing & Plans</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Current plan: <span className="capitalize font-medium">{currentPlan}</span></div>
          </div>
        </div>
        {usage?.within_limits === false && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.12)' }}>
            <Zap className="w-3 h-3" />
            Usage limit reached
          </div>
        )}
      </div>

      {/* Usage meters */}
      <div className="glass rounded-3xl p-4">
        <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Usage this billing period</div>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : usage ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <UsageBar label="AI messages" used={usage.current?.ai_messages ?? 0} limit={usage.limits?.ai_messages ?? 500} icon={MessageSquare} color="#8b5cf6" />
            <UsageBar label="Leads"       used={usage.current?.leads ?? 0}       limit={usage.limits?.leads ?? 100}         icon={Users}         color="#3b82f6" />
            <UsageBar label="Campaigns"   used={usage.current?.campaigns ?? 0}   limit={usage.limits?.campaigns ?? 1}       icon={TrendingUp}    color="#f59e0b" />
            <UsageBar label="Workflows"   used={usage.current?.workflows ?? 0}   limit={usage.limits?.workflows ?? 5}       icon={Zap}           color="#22c55e" />
            <UsageBar label="AI agents"   used={usage.current?.agents ?? 0}      limit={usage.limits?.agents ?? 1}          icon={Bot}           color="#ec4899" />
            <UsageBar label="Knowledge docs" used={usage.current?.knowledge_docs ?? 0} limit={usage.limits?.knowledge_docs ?? 10} icon={CheckCircle} color="#06b6d4" />
          </div>
        ) : (
          <div className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Could not load usage data</div>
        )}
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.id
          const isUpgrade = PLANS.findIndex(p => p.id === currentPlan) < PLANS.findIndex(p => p.id === plan.id)
          return (
            <div key={plan.id} className="glass rounded-3xl p-4 flex flex-col"
              style={{ border: plan.highlight ? `1.5px solid ${plan.color}30` : '1px solid rgba(0,0,0,0.06)', background: plan.highlight ? `${plan.color}04` : undefined }}>
              {plan.highlight && (
                <div className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-center mb-2 self-center"
                  style={{ background: `${plan.color}18`, color: plan.color }}>
                  Most popular
                </div>
              )}
              <div className="mb-3">
                <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{plan.name}</div>
                <div className="flex items-end gap-0.5">
                  <span className="text-xl font-bold" style={{ color: plan.color }}>{plan.price}</span>
                  {plan.period && <span className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>{plan.period}</span>}
                </div>
              </div>
              <ul className="space-y-1.5 flex-1 mb-4">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-1.5">
                    <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: plan.color }} />
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                disabled={isCurrent || checkout.isPending}
                onClick={() => handleUpgrade(plan.id)}
                className="w-full py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                style={{
                  background: isCurrent ? `${plan.color}12` : isUpgrade || plan.id === 'enterprise' ? plan.color : 'rgba(0,0,0,0.04)',
                  color: isCurrent ? plan.color : isUpgrade || plan.id === 'enterprise' ? '#fff' : 'var(--text-secondary)',
                }}>
                {isCurrent ? (
                  <><CheckCircle className="w-3 h-3" /> Current plan</>
                ) : checkout.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : plan.id === 'enterprise' ? (
                  <><ExternalLink className="w-3 h-3" /> Contact sales</>
                ) : isUpgrade ? (
                  <>Upgrade to {plan.name}</>
                ) : (
                  <><Lock className="w-3 h-3" /> Downgrade</>
                )}
              </button>
            </div>
          )
        })}
      </div>

      <div className="glass rounded-3xl p-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        All plans include a 14-day free trial. Prices in INR. Billed monthly. Cancel anytime.
      </div>
    </div>
  )
}
