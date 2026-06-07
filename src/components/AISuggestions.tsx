// ─── AISuggestions (updated) ──────────────────────────────────────────────────
// Drop this into Inbox.tsx to replace the existing AISuggestions component.
// It uses the full orchestrator pipeline instead of the simple PUT route.

import { useState, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Sparkles, RefreshCw, Check, ChevronDown, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

// Inline model config (same as rest of Inbox.tsx)
const MODEL_OPTIONS = [
  { value: 'command-a-03-2025',        label: 'Cohere Command A',       provider: 'cohere',    badge: 'CO' },
  { value: 'command-r-plus-08-2024',   label: 'Cohere Command R+',      provider: 'cohere',    badge: 'CO' },
  { value: 'claude-sonnet-4-6',        label: 'Claude Sonnet 4.6',      provider: 'anthropic', badge: 'AN' },
  { value: 'claude-haiku-4-5-20251001',label: 'Claude Haiku 4.5',       provider: 'anthropic', badge: 'AN' },
  { value: 'gpt-4o',                   label: 'GPT-4o',                 provider: 'openai',    badge: 'OA' },
  { value: 'gpt-4o-mini',             label: 'GPT-4o Mini',            provider: 'openai',    badge: 'OA' },
  { value: 'gemini-2.5-pro',           label: 'Gemini 2.5 Pro',         provider: 'gemini',    badge: 'GE' },
  { value: 'gemini-2.0-flash',         label: 'Gemini 2.0 Flash',       provider: 'gemini',    badge: 'GE' },
]

const PROVIDER_COLORS: Record<string, string> = {
  cohere: '#f97316', anthropic: '#8b5cf6', openai: '#22c55e', gemini: '#3b82f6',
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/6 ${className}`} />
}

function ModelPicker({ selected, onChange }: { selected: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const current = MODEL_OPTIONS.find(m => m.value === selected) ?? MODEL_OPTIONS[0]

  // Close on outside click — must check both button and dropdown refs
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Close on scroll so the fixed dropdown doesn't float away from its anchor
  useEffect(() => {
    if (!open) return
    const handle = () => setOpen(false)
    window.addEventListener('scroll', handle, true)
    return () => window.removeEventListener('scroll', handle, true)
  }, [open])

  function handleOpen() {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    // Position anchored to the top of the button; dropdown grows upward via bottom CSS
    setDropdownPos({ top: rect.top, left: rect.left })
    setOpen(o => !o)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all hover:shadow-sm"
        style={{
          background: `${PROVIDER_COLORS[current.provider]}12`,
          border: `1px solid ${PROVIDER_COLORS[current.provider]}30`,
          color: PROVIDER_COLORS[current.provider],
        }}>
        <span className="text-[10px] font-bold px-1 py-0.5 rounded-md text-white"
          style={{ background: PROVIDER_COLORS[current.provider] }}>
          {current.badge}
        </span>
        <span className="max-w-[96px] truncate">{current.label}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && dropdownPos && (
        <div
          ref={dropdownRef}
          className="w-56 rounded-2xl overflow-hidden"
          style={{
            position: 'fixed',
            // Anchor the bottom of the dropdown to the top of the button, with 8px gap
            bottom: `calc(100vh - ${dropdownPos.top}px + 8px)`,
            left: dropdownPos.left,
            zIndex: 9999,
            background: 'white',
            border: '1px solid rgba(0,0,0,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
          }}>
          {(['cohere', 'anthropic', 'openai', 'gemini'] as const).map(provider => {
            const models = MODEL_OPTIONS.filter(m => m.provider === provider)
            return (
              <div key={provider}>
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b"
                  style={{ color: PROVIDER_COLORS[provider], background: `${PROVIDER_COLORS[provider]}08`, borderColor: `${PROVIDER_COLORS[provider]}15` }}>
                  {provider}
                </div>
                {models.map(m => (
                  <button key={m.value} onClick={() => { onChange(m.value); setOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-50"
                    style={{ background: selected === m.value ? `${PROVIDER_COLORS[provider]}08` : 'transparent' }}>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white flex-shrink-0"
                      style={{ background: PROVIDER_COLORS[provider] }}>{m.badge}</span>
                    <span className="text-[12px] font-medium flex-1"
                      style={{ color: selected === m.value ? PROVIDER_COLORS[provider] : '#334155' }}>
                      {m.label}
                    </span>
                    {selected === m.value && <Check className="w-3 h-3 flex-shrink-0" style={{ color: PROVIDER_COLORS[provider] }} />}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── Main AISuggestions component ──────────────────────────────────────────────
export function AISuggestions({ convId, onUse }: { convId: string; onUse: (t: string) => void }) {
  const [model, setModel] = useState(MODEL_OPTIONS[0].value)
  const [reflectionLog, setReflectionLog] = useState<string[]>([])
  const [showLog, setShowLog] = useState(false)

  const currentModel = MODEL_OPTIONS.find(m => m.value === model) ?? MODEL_OPTIONS[0]

  const { mutate, data, isPending } = useMutation({
    mutationFn: async (payload: { conversation_id: string; model: string; provider: string }) => {
      const res = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Orchestration failed')
      return json.data
    },
    onSuccess: (d) => {
      if (d?.reflectionLog) setReflectionLog(d.reflectionLog)
    },
  })

  function generate() {
    mutate({ conversation_id: convId, model, provider: currentModel.provider })
  }

  useEffect(() => { generate() }, [convId])

  const suggestions: { text: string; label: string }[] = data?.suggestions ?? []

  return (
    <div className="rounded-2xl mb-3 overflow-hidden"
      style={{ background: 'rgba(34,197,94,0.03)', border: '1px solid rgba(34,197,94,0.12)' }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: 'rgba(34,197,94,0.08)' }}>
        <Brain className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
        <span className="text-xs font-semibold flex-1" style={{ color: '#166534' }}>
          AI Suggestions
          <span className="ml-1 text-[10px] font-normal opacity-60">· multi-agent</span>
        </span>
        <ModelPicker selected={model} onChange={v => setModel(v)} />
        <button onClick={generate} disabled={isPending}
          className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-black/5 transition-colors flex-shrink-0">
          <RefreshCw className={cn('w-3.5 h-3.5', isPending ? 'animate-spin' : '')}
            style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* Suggestions */}
      <div className="p-2">
        {isPending ? (
          <div className="space-y-2 p-1">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-4 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Click refresh to generate context-aware suggestions
          </div>
        ) : suggestions.map((s, i) => (
          <button key={i} onClick={() => onUse(s.text)}
            className="w-full p-2.5 rounded-xl mb-1.5 text-left group hover:shadow-sm transition-all active:scale-[0.99]"
            style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(34,197,94,0.1)' }}>
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5"
                style={{ background: `${PROVIDER_COLORS[currentModel.provider]}15`, color: PROVIDER_COLORS[currentModel.provider] }}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] leading-relaxed mb-0.5" style={{ color: 'var(--text-secondary)' }}>{s.text}</div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                  <span className="text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: '#22c55e' }}>Use →</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Footer with reflection log toggle */}
      {!isPending && suggestions.length > 0 && (
        <div className="px-3 py-2 border-t flex items-center gap-1.5"
          style={{ borderColor: 'rgba(34,197,94,0.08)', background: 'rgba(0,0,0,0.01)' }}>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white"
            style={{ background: PROVIDER_COLORS[currentModel.provider] }}>
            {currentModel.badge}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {currentModel.label} · reflection ✓
          </span>
          {reflectionLog.length > 0 && (
            <button onClick={() => setShowLog(v => !v)}
              className="ml-auto text-[10px] font-semibold transition-colors"
              style={{ color: '#22c55e' }}>
              {showLog ? 'Hide log' : 'Show log'}
            </button>
          )}
        </div>
      )}

      {/* Reflection log */}
      {showLog && reflectionLog.length > 0 && (
        <div className="px-3 pb-3">
          <div className="rounded-xl p-2.5 space-y-1"
            style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.08)' }}>
            {reflectionLog.map((line, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-[10px] font-bold mt-0.5" style={{ color: '#22c55e' }}>›</span>
                <span className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{line}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}