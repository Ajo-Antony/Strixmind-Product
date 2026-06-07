'use client'
import { useState } from 'react'
import { Brain, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signInError) {
      setError(signInError.message)
    } else {
      window.location.href = '/'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg,#f0fdf4 0%,#f7fdf8 50%,#ecfdf5 100%)' }}>
      <div className="ambient-1" style={{ position: 'fixed', top: '-20%', left: '-10%', opacity: 0.4 }} />
      <div className="ambient-2" style={{ position: 'fixed', bottom: '-20%', right: '-10%', opacity: 0.3 }} />

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="rounded-3xl p-8"
          style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(24px)', border: '1px solid rgba(34,197,94,0.12)', boxShadow: '0 32px 64px rgba(0,0,0,0.06)' }}>
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: 'linear-gradient(135deg,#166534,#22c55e)', boxShadow: '0 8px 24px rgba(34,197,94,0.4)' }}>
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>StrixMind</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Sign in to your workspace</div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }}
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5">
                  {showPass
                    ? <EyeOff className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                    : <Eye className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
                style={{ background: 'rgba(239,68,68,0.06)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.1)' }}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !email || !password}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all mt-2"
              style={{ background: 'linear-gradient(135deg,#166534,#22c55e)', boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t text-center text-[11px]" style={{ borderColor: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)' }}>
            Powered by Supabase Auth · AI by StrixMind
          </div>
        </div>
      </div>
    </div>
  )
}
