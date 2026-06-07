'use client'
import { useState } from 'react'
import { useAgents, useLeads, useConversations } from '@/lib/hooks'
import { Brain, Send, Sparkles, Target, Phone, MessageSquare, Loader2, ChevronDown, CheckCircle, XCircle, Zap, User } from 'lucide-react'
import { toast } from 'sonner'
import { getInitials, scoreColor, STAGE_LABELS, STAGE_COLORS, formatCurrency } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface OutreachResult {
  lead_id: string
  lead_name: string
  status: 'sent' | 'failed' | 'pending'
  message?: string
  error?: string
}

// ─── Individual lead outreach row ─────────────────────────────────────────────
function LeadOutreachRow({
  lead,
  selected,
  onToggle,
  result,
}: {
  lead: any
  selected: boolean
  onToggle: () => void
  result?: OutreachResult
}) {
  const sc = STAGE_COLORS[lead.stage] ?? STAGE_COLORS.new
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer group"
      style={{
        background: selected ? 'rgba(34,197,94,0.06)' : 'rgba(0,0,0,0.02)',
        border: `1px solid ${selected ? 'rgba(34,197,94,0.2)' : 'rgba(0,0,0,0.05)'}`,
      }}
      onClick={onToggle}
    >
      {/* Checkbox */}
      <div
        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
        style={{
          background: selected ? '#22c55e' : 'rgba(0,0,0,0.06)',
          border: `2px solid ${selected ? '#22c55e' : 'rgba(0,0,0,0.15)'}`,
        }}
      >
        {selected && <CheckCircle className="w-3 h-3 text-white" style={{ strokeWidth: 3 }} />}
      </div>

      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', color: '#166534' }}
      >
        {getInitials(lead.name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {lead.name}
        </div>
        <div className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          <Phone className="w-2.5 h-2.5" />
          {lead.phone}
          {lead.budget && <span>· {formatCurrency(lead.budget)}</span>}
        </div>
      </div>

      {/* Stage */}
      <span
        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
        style={{ background: sc.bg, color: sc.text }}
      >
        {STAGE_LABELS[lead.stage] ?? lead.stage}
      </span>

      {/* AI Score */}
      <span
        className="text-[11px] font-bold w-7 text-right flex-shrink-0"
        style={{ color: scoreColor(lead.ai_score) }}
      >
        {lead.ai_score}
      </span>

      {/* Result badge */}
      {result && (
        <div className="flex-shrink-0">
          {result.status === 'sent' && <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} />}
          {result.status === 'failed' && <XCircle className="w-4 h-4" style={{ color: '#dc2626' }} />}
          {result.status === 'pending' && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#f59e0b' }} />}
        </div>
      )}
    </div>
  )
}

// ─── Preview bubble ───────────────────────────────────────────────────────────
function MessagePreview({ text, agentName }: { text: string; agentName: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Sparkles className="w-3 h-3" style={{ color: '#22c55e' }} />
        <span className="text-[10px] font-semibold" style={{ color: '#166534' }}>
          {agentName} preview
        </span>
      </div>
      <div
        className="px-4 py-3 rounded-2xl text-[12.5px] leading-relaxed"
        style={{
          background: 'linear-gradient(135deg,#166534,#22c55e)',
          color: 'white',
          maxWidth: '85%',
          marginLeft: 'auto',
        }}
      >
        <div className="flex items-center gap-1 mb-1.5 opacity-70">
          <Sparkles className="w-2.5 h-2.5" />
          <span className="text-[10px]">AI Draft</span>
        </div>
        {text}
      </div>
    </div>
  )
}

// ─── Main AgentOutreach component ─────────────────────────────────────────────
export default function AgentOutreach() {
  const { data: agents } = useAgents()
  const { data: leads, isLoading: leadsLoading } = useLeads()

  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [stageFilter, setStageFilter] = useState<string>('new')
  const [customPrompt, setCustomPrompt] = useState('')
  const [previewMsg, setPreviewMsg] = useState('')
  const [results, setResults] = useState<Map<string, OutreachResult>>(new Map())
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [phase, setPhase] = useState<'setup' | 'preview' | 'done'>('setup')

  const activeAgents = (agents ?? []).filter((a: any) => a.active)
  const agent = activeAgents.find((a: any) => a.id === selectedAgent)

  const filteredLeads = (leads ?? []).filter((l: any) => {
    if (stageFilter === 'all') return true
    if (stageFilter === 'hot') return l.ai_score >= 70
    return l.stage === stageFilter
  })

  const toggleLead = (id: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set())
    } else {
      setSelectedLeads(new Set(filteredLeads.map((l: any) => l.id)))
    }
  }

  // Generate preview using Anthropic API
  async function generatePreview() {
    if (!agent) return toast.error('Select an agent first')
    if (selectedLeads.size === 0) return toast.error('Select at least one lead')

    setIsGenerating(true)
    try {
      const sampleLead = filteredLeads.find((l: any) => selectedLeads.has(l.id))
      const response = await fetch('/api/ai/preview-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agent.id,
          lead: sampleLead,
          custom_prompt: customPrompt,
        }),
      })
      if (!response.ok) throw new Error('Failed to generate preview')
      const data = await response.json()
      setPreviewMsg(data.message)
      setPhase('preview')
    } catch (err: any) {
      toast.error(err.message ?? 'Preview failed')
    } finally {
      setIsGenerating(false)
    }
  }

  // Send outreach to all selected leads
  async function sendOutreach() {
    if (!agent) return
    setIsSending(true)
    const pending = new Map<string, OutreachResult>()
    selectedLeads.forEach(id => {
      const lead = leads?.find((l: any) => l.id === id)
      pending.set(id, { lead_id: id, lead_name: lead?.name ?? id, status: 'pending' })
    })
    setResults(new Map(pending))

    // Process each lead sequentially
    for (const leadId of selectedLeads) {
      const lead = leads?.find((l: any) => l.id === leadId)
      try {
        const response = await fetch('/api/ai/send-outreach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_id: agent.id,
            lead_id: leadId,
            custom_prompt: customPrompt,
          }),
        })
        if (!response.ok) throw new Error('Send failed')
        const data = await response.json()
        setResults(prev => {
          const next = new Map(prev)
          next.set(leadId, { lead_id: leadId, lead_name: lead?.name ?? leadId, status: 'sent', message: data.message })
          return next
        })
      } catch (err: any) {
        setResults(prev => {
          const next = new Map(prev)
          next.set(leadId, { lead_id: leadId, lead_name: lead?.name ?? leadId, status: 'failed', error: err.message })
          return next
        })
      }
    }
    setIsSending(false)
    setPhase('done')
    const sentCount = [...results.values()].filter(r => r.status === 'sent').length
    toast.success(`Outreach sent to ${selectedLeads.size} leads`)
  }

  const STAGE_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'hot', label: '🔥 Hot (70+)' },
    { id: 'new', label: 'New' },
    { id: 'qualified', label: 'Qualified' },
    { id: 'contacted', label: 'Contacted' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'negotiation', label: 'Negotiation' },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Left: Config panel */}
      <div className="lg:col-span-2 space-y-3">
        {/* Agent selector */}
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}
            >
              <Brain className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Select Agent
            </span>
          </div>

          {activeAgents.length === 0 ? (
            <div
              className="p-3 rounded-xl text-xs text-center"
              style={{ background: 'rgba(239,68,68,0.06)', color: '#dc2626' }}
            >
              No active agents. Create & activate one in the Agents tab first.
            </div>
          ) : (
            <div className="space-y-1.5">
              {activeAgents.map((a: any) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAgent(a.id)}
                  className="w-full p-3 rounded-2xl text-left transition-all"
                  style={{
                    background: selectedAgent === a.id ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.02)',
                    border: `1px solid ${selectedAgent === a.id ? 'rgba(34,197,94,0.25)' : 'transparent'}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {a.name}
                    </span>
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {a.provider} · {a.model}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Custom goal */}
        <div className="glass rounded-3xl p-5">
          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
            Outreach Goal <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional override)</span>
          </div>
          <textarea
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            rows={3}
            placeholder="e.g. Invite them to our upcoming bridal expo this Saturday. Emphasise limited slots available."
            className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-none"
            style={{
              background: 'rgba(0,0,0,0.03)',
              border: '1px solid rgba(0,0,0,0.08)',
              color: 'var(--text-primary)',
            }}
          />
          <div className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
            Leave blank to use the agent's default system prompt
          </div>
        </div>

        {/* Summary */}
        <div className="glass rounded-3xl p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-bold" style={{ color: '#22c55e', letterSpacing: '-0.04em' }}>
                {selectedLeads.size}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>selected</div>
            </div>
            <div>
              <div className="text-lg font-bold" style={{ color: '#3b82f6', letterSpacing: '-0.04em' }}>
                {agent?.name?.split(' ')[0] ?? '—'}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>agent</div>
            </div>
            <div>
              <div className="text-lg font-bold" style={{ color: '#8b5cf6', letterSpacing: '-0.04em' }}>
                {phase === 'done' ? [...results.values()].filter(r => r.status === 'sent').length : '—'}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>sent</div>
            </div>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col gap-2">
          {phase === 'setup' && (
            <button
              onClick={generatePreview}
              disabled={isGenerating || !selectedAgent || selectedLeads.size === 0}
              className="w-full py-3 rounded-xl text-sm text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating preview…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Preview Message</>
              )}
            </button>
          )}
          {phase === 'preview' && (
            <>
              <button
                onClick={sendOutreach}
                disabled={isSending}
                className="w-full py-3 rounded-xl text-sm text-white font-semibold flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}
              >
                {isSending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                ) : (
                  <><Send className="w-4 h-4" /> Send to {selectedLeads.size} Lead{selectedLeads.size !== 1 ? 's' : ''}</>
                )}
              </button>
              <button
                onClick={() => setPhase('setup')}
                className="w-full py-2.5 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}
              >
                Edit
              </button>
            </>
          )}
          {phase === 'done' && (
            <button
              onClick={() => { setPhase('setup'); setResults(new Map()); setSelectedLeads(new Set()) }}
              className="w-full py-3 rounded-xl text-sm text-white font-semibold"
              style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}
            >
              Start New Outreach
            </button>
          )}
        </div>
      </div>

      {/* Right: Lead list + preview */}
      <div className="lg:col-span-3 space-y-3">
        {/* Preview panel */}
        {(phase === 'preview' || phase === 'done') && previewMsg && (
          <div
            className="glass rounded-3xl p-5"
            style={{ border: '1px solid rgba(34,197,94,0.15)' }}
          >
            <MessagePreview text={previewMsg} agentName={agent?.name ?? 'Agent'} />
            {phase === 'preview' && (
              <div
                className="mt-3 text-[11px] px-3 py-2 rounded-xl"
                style={{ background: 'rgba(34,197,94,0.06)', color: '#166534' }}
              >
                This message will be personalised per lead using their name, stage, budget, and intent before sending.
              </div>
            )}
          </div>
        )}

        {/* Lead list */}
        <div className="glass rounded-3xl p-5">
          {/* Filters */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1 flex-wrap">
              {STAGE_FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setStageFilter(f.id)}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all"
                  style={{
                    background: stageFilter === f.id ? 'rgba(34,197,94,0.12)' : 'transparent',
                    color: stageFilter === f.id ? '#166534' : 'var(--text-muted)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              onClick={selectAll}
              className="text-[11px] px-2.5 py-1 rounded-xl font-medium"
              style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)' }}
            >
              {selectedLeads.size === filteredLeads.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {/* Leads */}
          <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
            {leadsLoading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ background: 'rgba(0,0,0,0.04)' }} />
              ))
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-12 text-xs" style={{ color: 'var(--text-muted)' }}>
                No leads in this filter
              </div>
            ) : (
              filteredLeads.map((lead: any) => (
                <LeadOutreachRow
                  key={lead.id}
                  lead={lead}
                  selected={selectedLeads.has(lead.id)}
                  onToggle={() => toggleLead(lead.id)}
                  result={results.get(lead.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Results panel */}
        {phase === 'done' && results.size > 0 && (
          <div className="glass rounded-3xl p-5">
            <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Outreach Results
            </div>
            <div className="space-y-2">
              {[...results.values()].map(r => (
                <div key={r.lead_id} className="flex items-center gap-3 p-2.5 rounded-xl"
                  style={{
                    background: r.status === 'sent' ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                  }}>
                  {r.status === 'sent'
                    ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#22c55e' }} />
                    : <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#dc2626' }} />
                  }
                  <span className="text-xs font-medium flex-1" style={{ color: 'var(--text-primary)' }}>
                    {r.lead_name}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {r.status === 'sent' ? 'Message sent → Inbox' : r.error ?? 'Failed'}
                  </span>
                  {r.status === 'sent' && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'rgba(34,197,94,0.1)', color: '#166534' }}
                    >
                      In Inbox
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div
              className="mt-3 p-3 rounded-xl text-xs"
              style={{ background: 'rgba(34,197,94,0.06)', color: '#166534' }}
            >
              <MessageSquare className="w-3.5 h-3.5 inline mr-1.5" />
              All sent messages are visible in the Inbox with the lead context attached.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}