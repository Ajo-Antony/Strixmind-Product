import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function formatCurrency(amount: number | null | undefined): string {
  if (!amount) return '—'
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`
  return `₹${amount}`
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#f59e0b'
  if (score >= 40) return '#94a3b8'
  return '#f87171'
}

export const STAGE_LABELS: Record<string, string> = {
  new: 'New', qualified: 'Qualified', contacted: 'Contacted',
  scheduled: 'Scheduled', negotiation: 'Negotiation', converted: 'Converted', closed: 'Closed',
}

export const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  new:         { bg: 'rgba(148,163,184,0.15)', text: '#64748b' },
  qualified:   { bg: 'rgba(59,130,246,0.12)',  text: '#2563eb' },
  contacted:   { bg: 'rgba(245,158,11,0.12)',  text: '#d97706' },
  scheduled:   { bg: 'rgba(139,92,246,0.12)',  text: '#7c3aed' },
  negotiation: { bg: 'rgba(249,115,22,0.12)',  text: '#ea580c' },
  converted:   { bg: 'rgba(34,197,94,0.12)',   text: '#16a34a' },
  closed:      { bg: 'rgba(100,116,139,0.12)', text: '#475569' },
}

export const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  low:    { bg: 'rgba(148,163,184,0.12)', text: '#64748b' },
  medium: { bg: 'rgba(245,158,11,0.12)',  text: '#d97706' },
  high:   { bg: 'rgba(249,115,22,0.12)',  text: '#ea580c' },
  urgent: { bg: 'rgba(239,68,68,0.12)',   text: '#dc2626' },
}
