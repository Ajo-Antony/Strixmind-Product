export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalLeads },
    { count: newLeadsThisWeek },
    { count: convertedLeads },
    { count: activeConversations },
    { count: openTasks },
    { count: aiTasksGenerated },
    { data: aiStats },
    { data: leadsByStage },
    { data: recentLeads },
    { data: conversionRevenue },
    { data: monthlyLeads },
  ] = await Promise.all([
    db.from('leads').select('*', { count: 'exact', head: true }),
    db.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    db.from('leads').select('*', { count: 'exact', head: true }).eq('stage', 'converted'),
    db.from('conversations').select('*', { count: 'exact', head: true }).in('status', ['open', 'waiting']),
    db.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'done'),
    db.from('tasks').select('*', { count: 'exact', head: true }).eq('ai_generated', true),
    db.from('ai_requests').select('total_tokens, latency_ms, success, cost_usd').gte('created_at', startOfMonth),
    db.from('leads').select('stage').then((r: any) => ({
      data: r.data
        ? Object.entries(
            r.data.reduce((acc: Record<string, number>, l: any) => {
              acc[l.stage] = (acc[l.stage] || 0) + 1
              return acc
            }, {})
          ).map(([stage, count]) => ({ stage, count }))
        : [],
    })),
    db.from('leads').select('name, ai_score, stage, budget, created_at').order('ai_score', { ascending: false }).limit(5),
    db.from('leads').select('budget').eq('stage', 'converted').not('budget', 'is', null),
    db.from('leads')             // was serial — now runs in parallel
      .select('budget, converted_at')
      .eq('stage', 'converted')
      .not('converted_at', 'is', null)
      .gte('converted_at', sixMonthsAgo),
  ])

  // AI stats aggregation
  const totalTokens = (aiStats ?? []).reduce((s: number, r: any) => s + (r.total_tokens ?? 0), 0)
  const avgLatency = aiStats?.length
    ? Math.round((aiStats as any[]).reduce((s: number, r: any) => s + (r.latency_ms ?? 0), 0) / aiStats.length)
    : 0
  const successRate = aiStats?.length
    ? Math.round(((aiStats as any[]).filter(r => r.success).length / aiStats.length) * 100)
    : 100
  const totalCost = (aiStats ?? []).reduce((s: number, r: any) => s + (r.cost_usd ?? 0), 0)

  // Revenue
  const totalRevenue = (conversionRevenue ?? []).reduce((s: number, l: any) => s + (l.budget ?? 0), 0)
  const conversionRate = totalLeads ? Math.round(((convertedLeads ?? 0) / (totalLeads ?? 1)) * 100) : 0

  const monthlyRevenue: Record<string, number> = {}
  ;(monthlyLeads ?? []).forEach((l: any) => {
    if (!l.converted_at) return
    const month = new Date(l.converted_at).toLocaleDateString('en-IN', { month: 'short' })
    monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (l.budget ?? 0)
  })

  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    return d.toLocaleDateString('en-IN', { month: 'short' })
  })

  const revenueChart = last6Months.map(month => ({
    month,
    value: monthlyRevenue[month] ?? 0,
  }))

  return NextResponse.json({
    data: {
      totalLeads: totalLeads ?? 0,
      newLeadsThisWeek: newLeadsThisWeek ?? 0,
      convertedLeads: convertedLeads ?? 0,
      activeConversations: activeConversations ?? 0,
      openTasks: openTasks ?? 0,
      aiTasksGenerated: aiTasksGenerated ?? 0,
      conversionRate,
      totalRevenue,
      revenueChart,
      leadsByStage,
      topLeads: recentLeads ?? [],
      ai: {
        totalTokens,
        avgLatency,
        successRate,
        totalCost: parseFloat(totalCost.toFixed(4)),
        requestCount: aiStats?.length ?? 0,
      },
    },
  })
}
