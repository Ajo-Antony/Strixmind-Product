/**
 * src/lib/hooks.ts — ADDITIONS for new features
 *
 * Add these exports to your existing hooks.ts file.
 * They follow the exact same pattern as the existing hooks.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ── existing helpers (already in your hooks.ts) ───────────────────
declare function apiFetch(url: string): Promise<any>
declare function apiMutate(url: string, method: string, data: object): Promise<any>

// ════════════════════════════════════════════════════════════════════
// FEATURE 3 — Lead Qualification
// ════════════════════════════════════════════════════════════════════
export function useQualifyLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { lead_id: string; conversation_id?: string }) =>
      apiMutate('/api/leads/qualify', 'POST', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useBulkQualify(limit = 20) {
  return useQuery({
    queryKey: ['leads', 'bulk-qualify', limit],
    queryFn: () => apiFetch(`/api/leads/qualify?limit=${limit}`),
    enabled: false,  // trigger manually
  })
}

// ════════════════════════════════════════════════════════════════════
// FEATURE 4 — Human Handoff
// ════════════════════════════════════════════════════════════════════
export function useHandoff() {
  return useMutation({
    mutationFn: (data: {
      conversation_id: string
      draft_reply: string
      user_message: string
      contact_phone: string
    }) => apiMutate('/api/leads/handoff', 'POST', data),
  })
}

export function useResumeAI() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { conversation_id: string; resume_ai: boolean }) =>
      apiMutate('/api/leads/handoff', 'PATCH', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  })
}

// ════════════════════════════════════════════════════════════════════
// FEATURE 5 — Knowledge Base
// ════════════════════════════════════════════════════════════════════
export function useKnowledgeDocuments(category?: string) {
  return useQuery({
    queryKey: ['knowledge', category],
    queryFn: () => apiFetch(`/api/knowledge${category ? `?category=${category}` : ''}`),
  })
}

export function useAddKnowledge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; content: string; category: string; metadata?: object }) =>
      apiMutate('/api/knowledge', 'POST', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge'] }),
  })
}

export function useDeleteKnowledge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge'] }),
  })
}

export function useRAGRetrieve() {
  return useMutation({
    mutationFn: (data: { query: string; conversation_id?: string; generate_answer?: boolean }) =>
      apiMutate('/api/knowledge?action=retrieve', 'POST', data),
  })
}

// ════════════════════════════════════════════════════════════════════
// FEATURE 6 — WhatsApp Retry Queue
// ════════════════════════════════════════════════════════════════════
export function useRetryQueue() {
  return useQuery({
    queryKey: ['retry-queue'],
    queryFn: () => apiFetch('/api/whatsapp/retry'),
    refetchInterval: 60_000,  // check every minute
  })
}

export function useEnqueueRetry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: object) => apiMutate('/api/whatsapp/retry', 'POST', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['retry-queue'] }),
  })
}

// ════════════════════════════════════════════════════════════════════
// FEATURE 7 — Campaign Analytics
// ════════════════════════════════════════════════════════════════════
export function useCampaignMetrics(campaignId?: string) {
  return useQuery({
    queryKey: ['campaign-metrics', campaignId],
    queryFn: () => apiFetch(`/api/campaigns/analytics${campaignId ? `?id=${campaignId}` : ''}`),
    refetchInterval: 5 * 60_000,  // refresh every 5 min
  })
}

export function useComputeCampaignMetrics() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (campaignId: string) =>
      apiMutate('/api/campaigns/analytics', 'POST', { campaign_id: campaignId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign-metrics'] }),
  })
}

// ════════════════════════════════════════════════════════════════════
// FEATURE 8 — Billing
// ════════════════════════════════════════════════════════════════════
export function useUsageLimits(orgId = 'default') {
  return useQuery({
    queryKey: ['billing', 'usage', orgId],
    queryFn: () => apiFetch(`/api/billing?org_id=${orgId}`),
    refetchInterval: 10 * 60_000,
  })
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: (data: { org_id: string; plan_id: string }) =>
      apiMutate('/api/billing', 'POST', data),
  })
}

// ════════════════════════════════════════════════════════════════════
// FEATURE 9 — Notifications
// ════════════════════════════════════════════════════════════════════
export function useNotifications(unreadOnly = false, recipient?: string) {
  return useQuery({
    queryKey: ['notifications', unreadOnly, recipient],
    queryFn: () => apiFetch(
      `/api/notifications?unread=${unreadOnly}${recipient ? `&recipient=${recipient}` : ''}`
    ),
    refetchInterval: 30_000,  // poll every 30s
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { id?: string; all_read?: boolean }) =>
      apiMutate('/api/notifications', 'PATCH', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useSendNotification() {
  return useMutation({
    mutationFn: (data: object) => apiMutate('/api/notifications', 'POST', data),
  })
}

// ════════════════════════════════════════════════════════════════════
// FEATURE 10 — Appointment Reminders
// ════════════════════════════════════════════════════════════════════
export function useRunReminderJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch('/api/appointments/reminders'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  })
}

// ════════════════════════════════════════════════════════════════════
// FEATURE 11 — AI Cost Monitoring
// ════════════════════════════════════════════════════════════════════
export function useAICosts(days = 30) {
  return useQuery({
    queryKey: ['ai-costs', days],
    queryFn: () => apiFetch(`/api/ai/costs?days=${days}`),
    staleTime: 5 * 60_000,
  })
}

// ════════════════════════════════════════════════════════════════════
// FEATURE 12 — Customer Memory
// ════════════════════════════════════════════════════════════════════
export function useCustomerProfile(contactId?: string) {
  return useQuery({
    queryKey: ['memory', contactId],
    queryFn: () => apiFetch(`/api/memory?contact_id=${contactId}`),
    enabled: !!contactId,
  })
}

export function useRebuildProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (contactId: string) =>
      apiMutate('/api/memory', 'POST', { contact_id: contactId }),
    onSuccess: (_, contactId) => qc.invalidateQueries({ queryKey: ['memory', contactId] }),
  })
}
