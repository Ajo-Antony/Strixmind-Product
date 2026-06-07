'use client'
import { useState } from 'react'
import { useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent, useTestAgent } from '@/lib/hooks'
import { Brain, Plus, Trash2, Play, Loader2, CheckCircle, XCircle, Edit2 } from 'lucide-react'
import { toast } from 'sonner'

const PROVIDERS = ['openai', 'anthropic', 'gemini', 'cohere']
const MODELS: Record<string, string[]> = {
  openai:    ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  gemini:    ['gemini-1.5-pro', 'gemini-1.5-flash'],
  cohere:    ['command-a-03-2025', 'command-r-plus-08-2024', 'command-r-08-2024'],
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/6 ${className}`} />
}

const DEFAULT_FORM = {
  name: 'Cohere Lead Qualifier',
  description: 'Qualifies bridal & fashion leads using Cohere Command R+',
  provider: 'cohere',
  model: 'command-a-03-2025',
  system_prompt: `You are an expert sales assistant for a premium bridal and fashion boutique called StrixMind.

Your job is to qualify incoming WhatsApp leads by understanding:
- What the customer is looking for (bridal, saree, occasion wear, gifting)
- Their budget range in INR
- Their urgency and timeline (e.g. wedding date)
- Their sentiment and purchase intent

Rules:
- Always be warm, empathetic, and professional
- Use natural conversational language — never robotic
- Ask one focused follow-up question at a time
- Gently guide the conversation toward booking an in-store appointment
- Use emojis sparingly and naturally 🌸
- If budget is mentioned, acknowledge it positively
- If a wedding date is near, treat the lead as high urgency

When you have enough information, summarize the lead's intent and suggest a next action.`,
  temperature: '0.5',
  max_tokens: '800',
  active: true,
}

export default function Agents() {
  const { data: agents, isLoading } = useAgents()
  const createAgent = useCreateAgent()
  const updateAgent = useUpdateAgent()
  const deleteAgent = useDeleteAgent()
  const testAgent = useTestAgent()

  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [testMsg, setTestMsg] = useState('Hello, I am interested in your bridal collection.')
  const [testResult, setTestResult] = useState<any>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'new'>('view')

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }

  function openNew() {
    setForm(DEFAULT_FORM)
    setSelected(null)
    setTestResult(null)
    setMode('new')
  }

  function openEdit(agent: any) {
    setSelected(agent)
    setForm({
      name: agent.name,
      description: agent.description ?? '',
      provider: agent.provider,
      model: agent.model,
      system_prompt: agent.system_prompt,
      temperature: String(agent.temperature),
      max_tokens: String(agent.max_tokens),
      active: agent.active,
    })
    setTestResult(null)
    setMode('edit')
  }

  function openView(agent: any) {
    setSelected(agent)
    setTestResult(null)
    setMode('view')
  }

  async function handleSave() {
    if (!form.name || !form.system_prompt) return toast.error('Name and system prompt required')
    const payload = {
      ...form,
      temperature: parseFloat(form.temperature),
      max_tokens: parseInt(form.max_tokens),
    }
    try {
      if (mode === 'new') {
        const created = await createAgent.mutateAsync(payload)
        toast.success('Agent created')
        openView(created)
      } else {
        const updated = await updateAgent.mutateAsync({ id: selected.id, ...payload })
        toast.success('Agent updated')
        openView(updated)
      }
    } catch (err: any) { toast.error(err.message) }
  }

  async function handleDelete(agent: any) {
    if (!confirm(`Delete "${agent.name}"?`)) return
    try {
      await deleteAgent.mutateAsync(agent.id)
      toast.success('Agent deleted')
      setSelected(null)
      setMode('view')
    } catch (err: any) { toast.error(err.message) }
  }

  async function handleTest() {
    const payload = mode === 'view' ? {
      provider: selected.provider, model: selected.model,
      system_prompt: selected.system_prompt, temperature: selected.temperature, test_message: testMsg,
    } : {
      provider: form.provider, model: form.model,
      system_prompt: form.system_prompt, temperature: parseFloat(form.temperature), test_message: testMsg,
    }
    try {
      const result = await testAgent.mutateAsync(payload)
      setTestResult(result)
    } catch (err: any) { toast.error(err.message) }
  }

  const toggle = async (agent: any) => {
    try {
      await updateAgent.mutateAsync({ id: agent.id, active: !agent.active })
      if (selected?.id === agent.id) setSelected({ ...agent, active: !agent.active })
      toast.success(agent.active ? 'Agent deactivated' : 'Agent activated')
    } catch (err: any) { toast.error(err.message) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Agent list */}
      <div className="glass rounded-3xl p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>AI Agents</span>
          <button onClick={openNew}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-white"
            style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}>
            <Plus className="w-3 h-3" /> New
          </button>
        </div>
        <div className="space-y-1.5">
          {isLoading ? Array(3).fill(0).map((_,i) => <Skeleton key={i} className="h-16 w-full" />) :
            (agents ?? []).length === 0 ? (
              <div className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>No agents yet</div>
            ) : (agents ?? []).map((agent: any) => (
              <button key={agent.id} onClick={() => openView(agent)}
                className="w-full p-3 rounded-2xl text-left transition-all group"
                style={{
                  background: selected?.id === agent.id ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${selected?.id === agent.id ? 'rgba(34,197,94,0.2)' : 'transparent'}`,
                }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5" style={{ color: agent.active ? '#22c55e' : '#94a3b8' }} />
                    <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{agent.name}</span>
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: agent.active ? '#22c55e' : '#94a3b8' }} />
                </div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {agent.provider} · {agent.model}
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* Detail / Editor */}
      <div className="glass rounded-3xl p-5 lg:col-span-2">
        {mode === 'view' && !selected ? (
          <div className="flex items-center justify-center h-full py-20 text-center">
            <div>
              <Brain className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Select an agent</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Or create a new one to automate AI responses</div>
            </div>
          </div>
        ) : mode === 'view' && selected ? (
          <>
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="text-base font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{selected.name}</div>
                {selected.description && <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{selected.description}</div>}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(34,197,94,0.08)', color: '#166534' }}>
                    {selected.provider}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>
                    {selected.model}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>temp {selected.temperature}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggle(selected)}
                  className="text-xs px-2.5 py-1.5 rounded-xl font-medium"
                  style={{
                    background: selected.active ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.1)',
                    color: selected.active ? '#dc2626' : '#166534',
                  }}>
                  {selected.active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => openEdit(selected)}
                  className="text-xs px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1"
                  style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
                <button onClick={() => handleDelete(selected)}
                  className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />
                </button>
              </div>
            </div>

            <div className="p-3 rounded-2xl mb-4" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>System Prompt</div>
              <pre className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                {selected.system_prompt}
              </pre>
            </div>

            {/* Test panel */}
            <div className="p-4 rounded-2xl" style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)' }}>
              <div className="text-xs font-semibold mb-3" style={{ color: '#166534' }}>Test Agent</div>
              <textarea value={testMsg} onChange={e => setTestMsg(e.target.value)} rows={2}
                placeholder="Enter a test message…"
                className="w-full px-3 py-2 rounded-xl text-xs outline-none resize-none mb-3"
                style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(34,197,94,0.12)', color: 'var(--text-primary)' }} />
              <button onClick={handleTest} disabled={testAgent.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs text-white font-medium"
                style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}>
                {testAgent.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Run Test
              </button>
              {testResult && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {testResult.provider} · {testResult.model} · {testResult.latency}ms · {testResult.tokens} tokens
                    </span>
                  </div>
                  <div className="p-3 rounded-xl text-xs leading-relaxed"
                    style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(34,197,94,0.12)', color: 'var(--text-primary)' }}>
                    {testResult.response}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Edit / New form */
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {mode === 'new' ? 'Create Agent' : 'Edit Agent'}
              </h2>
              <button onClick={() => { setMode('view') }}
                className="text-xs px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
            </div>
            <div className="space-y-3 mb-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Name *</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Lead Qualifier"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Description</label>
                  <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="What this agent does"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Provider</label>
                  <select value={form.provider} onChange={e => { set('provider', e.target.value); set('model', MODELS[e.target.value][0]) }}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }}>
                    {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Model</label>
                  <select value={form.model} onChange={e => set('model', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }}>
                    {(MODELS[form.provider] ?? []).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Temperature (0–1)</label>
                  <input type="number" min="0" max="1" step="0.1" value={form.temperature} onChange={e => set('temperature', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Max Tokens</label>
                  <input type="number" value={form.max_tokens} onChange={e => set('max_tokens', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>System Prompt *</label>
                <textarea value={form.system_prompt} onChange={e => set('system_prompt', e.target.value)} rows={8}
                  placeholder="You are a helpful assistant for…"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                  style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)', fontFamily: 'inherit' }} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)}
                  className="w-4 h-4 rounded" />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Active (agent will be used in automation)</span>
              </label>
            </div>

            {/* Test before save */}
            <div className="p-3 rounded-2xl mb-4" style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)' }}>
              <div className="text-xs font-semibold mb-2" style={{ color: '#166534' }}>Test before saving</div>
              <div className="flex gap-2">
                <input value={testMsg} onChange={e => setTestMsg(e.target.value)} placeholder="Test message…"
                  className="flex-1 px-3 py-1.5 rounded-xl text-xs outline-none"
                  style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(34,197,94,0.12)', color: 'var(--text-primary)' }} />
                <button onClick={handleTest} disabled={testAgent.isPending || !form.system_prompt}
                  className="px-3 py-1.5 rounded-xl text-xs text-white flex items-center gap-1.5 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}>
                  {testAgent.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Test
                </button>
              </div>
              {testResult && (
                <div className="mt-2 p-2.5 rounded-xl text-[11px] leading-relaxed"
                  style={{ background: 'rgba(255,255,255,0.8)', color: 'var(--text-primary)' }}>
                  {testResult.response}
                </div>
              )}
            </div>

            <button onClick={handleSave} disabled={createAgent.isPending || updateAgent.isPending}
              className="w-full py-2.5 rounded-xl text-sm text-white font-medium flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}>
              {(createAgent.isPending || updateAgent.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'new' ? 'Create Agent' : 'Save Changes'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
