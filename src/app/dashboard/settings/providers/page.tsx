'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Zap, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Trash2,
  ExternalLink, ChevronDown, Shield, Activity, Cpu, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { PROVIDER_CONFIGS } from '@/lib/ai/providers'
import type { ProviderConfig, ProviderName } from '@/lib/ai/providers'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SavedProvider {
  id: string
  provider: ProviderName
  model: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

type TestState = 'idle' | 'testing' | 'success' | 'error'

interface ProviderFormState {
  apiKey: string
  model: string
  showKey: boolean
  expanded: boolean
  testState: TestState
  testLatency: number | null
  testError: string | null
  saving: boolean
}

// ─── Provider Card ────────────────────────────────────────────────────────────
function ProviderCard({
  config,
  saved,
  onSave,
  onToggle,
  onDelete,
}: {
  config: ProviderConfig
  saved: SavedProvider | null
  onSave: (provider: ProviderName, key: string, model: string) => Promise<void>
  onToggle: (id: string, active: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [form, setForm] = useState<ProviderFormState>({
    apiKey: '',
    model: saved?.model ?? config.models[0].id,
    showKey: false,
    expanded: !saved,
    testState: 'idle',
    testLatency: null,
    testError: null,
    saving: false,
  })

  const patch = (updates: Partial<ProviderFormState>) =>
    setForm(prev => ({ ...prev, ...updates }))

  const handleTest = useCallback(async () => {
    if (!form.apiKey) return toast.error('Enter an API key first')
    patch({ testState: 'testing', testError: null, testLatency: null })
    try {
      const res = await fetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: config.name, api_key: form.apiKey, model: form.model }),
      })
      const data = await res.json()
      if (data.success) {
        patch({ testState: 'success', testLatency: data.latencyMs })
        toast.success(`Connected! ${data.latencyMs}ms`)
      } else {
        patch({ testState: 'error', testError: data.error ?? 'Connection failed' })
        toast.error(data.error ?? 'Connection failed')
      }
    } catch (err: any) {
      patch({ testState: 'error', testError: err.message })
      toast.error(err.message)
    }
  }, [form.apiKey, form.model, config.name])

  const handleSave = useCallback(async () => {
    if (!form.apiKey) return toast.error('Enter an API key first')
    patch({ saving: true })
    try {
      await onSave(config.name, form.apiKey, form.model)
      patch({ apiKey: '', expanded: false, saving: false })
      toast.success(`${config.label} saved`)
    } catch (err: any) {
      patch({ saving: false })
      toast.error(err.message)
    }
  }, [form.apiKey, form.model, config.name, config.label, onSave])

  const isConfigured = !!saved

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: isConfigured
          ? `1px solid ${config.color}40`
          : '1px solid rgba(0,0,0,0.07)',
        boxShadow: isConfigured
          ? `0 0 0 1px ${config.color}20, 0 4px 24px rgba(0,0,0,0.06)`
          : '0 2px 12px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{ background: `${config.color}15`, border: `1px solid ${config.color}30` }}
        >
          {config.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              {config.label}
            </span>
            {isConfigured && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: `${config.color}18`, color: config.color }}
              >
                {saved!.is_active ? 'Active' : 'Inactive'}
              </span>
            )}
          </div>
          <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
            {config.description}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isConfigured && (
            <>
              {/* Toggle switch */}
              <button
                onClick={() => onToggle(saved!.id, !saved!.is_active)}
                className="relative w-9 h-5 rounded-full transition-colors duration-200"
                style={{ background: saved!.is_active ? config.color : 'rgba(0,0,0,0.12)' }}
                title={saved!.is_active ? 'Deactivate' : 'Activate'}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200"
                  style={{ transform: saved!.is_active ? 'translateX(18px)' : 'translateX(2px)' }}
                />
              </button>

              {/* Delete */}
              <button
                onClick={() => onDelete(saved!.id)}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                title="Remove key"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </>
          )}

          {/* Expand/collapse */}
          <button
            onClick={() => patch({ expanded: !form.expanded })}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/5 transition-colors"
          >
            <ChevronDown
              className="w-4 h-4 transition-transform duration-200"
              style={{
                color: 'var(--text-muted)',
                transform: form.expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>
        </div>
      </div>

      {/* Configured info banner */}
      {isConfigured && !form.expanded && (
        <div
          className="mx-4 mb-4 px-3 py-2.5 rounded-xl flex items-center gap-2"
          style={{ background: `${config.color}0d`, border: `1px solid ${config.color}20` }}
        >
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: config.color }} />
          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            API key saved · Model: <strong>{saved!.model ?? config.models[0].label}</strong>
          </span>
          <button
            onClick={() => patch({ expanded: true })}
            className="ml-auto text-[10px] font-medium underline underline-offset-2"
            style={{ color: config.color }}
          >
            Edit
          </button>
        </div>
      )}

      {/* Expanded form */}
      {form.expanded && (
        <div className="px-5 pb-5 space-y-3">
          <div
            className="h-px"
            style={{ background: 'rgba(0,0,0,0.05)' }}
          />

          {/* API Key input */}
          <div>
            <label className="block text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              API Key
              <a
                href={config.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 inline-flex items-center gap-0.5 opacity-60 hover:opacity-100 transition-opacity"
              >
                Get key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </label>
            <div className="relative">
              <input
                type={form.showKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={e => patch({ apiKey: e.target.value, testState: 'idle' })}
                placeholder={`Enter ${config.label} API key…`}
                className="w-full h-9 pl-3 pr-9 rounded-xl text-[13px] font-mono outline-none transition-all"
                style={{
                  background: 'rgba(0,0,0,0.03)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  color: 'var(--text-primary)',
                }}
                onFocus={e => {
                  e.currentTarget.style.border = `1px solid ${config.color}60`
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${config.color}12`
                }}
                onBlur={e => {
                  e.currentTarget.style.border = '1px solid rgba(0,0,0,0.08)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <button
                onClick={() => patch({ showKey: !form.showKey })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {form.showKey
                  ? <EyeOff className="w-3.5 h-3.5" />
                  : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Model selector */}
          <div>
            <label className="block text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Default Model
            </label>
            <div className="grid grid-cols-2 gap-2">
              {config.models.map(m => (
                <button
                  key={m.id}
                  onClick={() => patch({ model: m.id })}
                  className="p-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: form.model === m.id ? `${config.color}10` : 'rgba(0,0,0,0.02)',
                    border: form.model === m.id ? `1px solid ${config.color}40` : '1px solid rgba(0,0,0,0.06)',
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Cpu className="w-3 h-3" style={{ color: form.model === m.id ? config.color : 'var(--text-muted)' }} />
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {m.label}
                    </span>
                  </div>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {m.description} · {(m.contextWindow / 1000).toFixed(0)}k ctx
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Test result */}
          {form.testState !== 'idle' && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px]"
              style={{
                background: form.testState === 'success' ? '#dcfce7' : form.testState === 'error' ? '#fef2f2' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${form.testState === 'success' ? '#86efac' : form.testState === 'error' ? '#fca5a5' : 'rgba(0,0,0,0.06)'}`,
              }}
            >
              {form.testState === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
              {form.testState === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              {form.testState === 'error' && <XCircle className="w-3.5 h-3.5 text-red-400" />}
              <span style={{ color: form.testState === 'success' ? '#166534' : form.testState === 'error' ? '#991b1b' : 'var(--text-muted)' }}>
                {form.testState === 'testing' && 'Testing connection…'}
                {form.testState === 'success' && `Connected in ${form.testLatency}ms`}
                {form.testState === 'error' && (form.testError ?? 'Connection failed')}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleTest}
              disabled={!form.apiKey || form.testState === 'testing'}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium transition-all disabled:opacity-40"
              style={{
                background: 'rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.08)',
                color: 'var(--text-secondary)',
              }}
            >
              {form.testState === 'testing'
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Activity className="w-3.5 h-3.5" />}
              Test
            </button>

            <button
              onClick={handleSave}
              disabled={!form.apiKey || form.saving}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-semibold transition-all disabled:opacity-40"
              style={{
                background: config.color,
                color: '#fff',
                boxShadow: `0 2px 8px ${config.color}40`,
              }}
            >
              {form.saving
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Shield className="w-3.5 h-3.5" />}
              {form.saving ? 'Saving…' : isConfigured ? 'Update Key' : 'Save Key'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProvidersSettingsPage() {
  const [savedProviders, setSavedProviders] = useState<SavedProvider[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/providers')
      const data = await res.json()
      setSavedProviders(data.providers ?? [])
    } catch {
      // ignore — DB might not have the table yet
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProviders() }, [fetchProviders])

  const handleSave = useCallback(async (provider: ProviderName, apiKey: string, model: string) => {
    const res = await fetch('/api/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, api_key: apiKey, model, is_active: true }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error ?? 'Save failed')
    await fetchProviders()
  }, [fetchProviders])

  const handleToggle = useCallback(async (id: string, isActive: boolean) => {
    const res = await fetch('/api/providers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: isActive }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error ?? 'Update failed')
    setSavedProviders(prev =>
      prev.map(p => p.id === id ? { ...p, is_active: isActive } : p)
    )
    toast.success(isActive ? 'Provider activated' : 'Provider deactivated')
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Remove this API key?')) return
    const res = await fetch('/api/providers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (!data.success) { toast.error(data.error ?? 'Delete failed'); return }
    setSavedProviders(prev => prev.filter(p => p.id !== id))
    toast.success('API key removed')
  }, [])

  const activeCount = savedProviders.filter(p => p.is_active).length

  return (
    <div className="min-h-screen p-6 lg:p-8" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #22c55e20, #16a34a20)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                AI Providers
              </h1>
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                Manage API keys for your AI providers
              </p>
            </div>
          </div>

          {/* Stats bar */}
          {!loading && savedProviders.length > 0 && (
            <div
              className="mt-4 flex items-center gap-4 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.06)', backdropFilter: 'blur(12px)' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />
                <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  <strong>{activeCount}</strong> active provider{activeCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div
                className="h-3 w-px"
                style={{ background: 'rgba(0,0,0,0.08)' }}
              />
              <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                {savedProviders.length} of {PROVIDER_CONFIGS.length} configured
              </span>
            </div>
          )}
        </div>

        {/* Provider cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : (
          <div className="space-y-3">
            {PROVIDER_CONFIGS.map(config => (
              <ProviderCard
                key={config.name}
                config={config}
                saved={savedProviders.find(p => p.provider === config.name) ?? null}
                onSave={handleSave}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Security notice */}
        <div
          className="mt-6 flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)' }}
        >
          <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            API keys are stored encrypted in your Supabase database and are never exposed to the client.
            Keys are only decrypted server-side when making AI requests.
          </p>
        </div>
      </div>
    </div>
  )
}
