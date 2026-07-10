'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useEffect, useRef } from 'react'

const supabase = () => getSupabaseBrowserClient()

// ─── Fetch helpers ────────────────────────────────────────────
async function apiFetch(url: string) {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Request failed')
  return json.data
}

async function apiMutate(url: string, method: string, body?: object) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Request failed')
  return json.data
}

// ─── Global Realtime Hook ─────────────────────────────────────
// Call once at the top of your app (e.g. in layout or a provider).
// This subscribes to all tables in a single channel, avoiding the
// "cannot add callbacks after subscribe()" error caused by multiple
// hook instances each trying to create the same channel name.
export function useRealtimeSync() {
  const qc = useQueryClient()
  const channelRef = useRef<ReturnType<ReturnType<typeof supabase>['channel']> | null>(null)

  useEffect(() => {
    // Guard: if already subscribed (React Strict Mode double-mount), skip
    if (channelRef.current) return

    const channel = supabase()
      .channel('app-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        qc.invalidateQueries({ queryKey: ['conversations'] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        qc.invalidateQueries({ queryKey: ['conversations'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        qc.invalidateQueries({ queryKey: ['leads'] })
        qc.invalidateQueries({ queryKey: ['analytics'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        qc.invalidateQueries({ queryKey: ['tasks'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => {
        qc.invalidateQueries({ queryKey: ['campaigns'] })
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase().removeChannel(channel)
      channelRef.current = null
    }
  }, [qc])
}

// ─── Per-conversation message realtime ───────────────────────
// This one is keyed by conversationId so it's safe — each instance
// gets a unique channel name like "messages-abc123"
function useMessageRealtime(conversationId: string | null) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!conversationId) return
    const channel = supabase()
      .channel(`messages-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['messages', conversationId] })
      })
      .subscribe()
    return () => { supabase().removeChannel(channel) }
  }, [conversationId, qc])
}

// ─── Conversations ────────────────────────────────────────────
export function useConversations(status?: string) {
  const url = `/api/conversations${status && status !== 'all' ? `?status=${status}` : ''}`
  return useQuery({
    queryKey: ['conversations', status ?? 'all'],
    queryFn: () => apiFetch(url),
    staleTime: 15_000,
    refetchInterval: false,        // realtime via useRealtimeSync() covers updates
    refetchOnWindowFocus: false,
  })
  // Realtime is handled by useRealtimeSync()
}

export function useUpdateConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string; [key: string]: any }) =>
      apiMutate('/api/conversations', 'PATCH', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  })
}

// ─── Messages ─────────────────────────────────────────────────
export function useMessages(conversationId: string | null) {
  useMessageRealtime(conversationId)
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => apiFetch(`/api/messages?conversation_id=${conversationId}`),
    enabled: !!conversationId,
    staleTime: 30_000,
    refetchInterval: false,        // useMessageRealtime subscription handles updates
    refetchOnWindowFocus: false,
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { conversation_id: string; content: string; type?: string }) =>
      apiMutate('/api/messages', 'POST', data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['messages', vars.conversation_id] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useReplySuggestions() {
  return useMutation({
    mutationFn: (data: { conversation_id: string; model?: string; provider?: string }) =>
      apiMutate('/api/messages', 'PUT', data),
  })
}

export function useOrchestrator() {
  return useMutation({
    mutationFn: (data: { conversation_id: string; model?: string; provider?: string }) =>
      apiMutate('/api/orchestrate', 'POST', data),
  })
}

// ─── Leads ────────────────────────────────────────────────────
export function useLeads(stage?: string, search?: string) {
  const params = new URLSearchParams()
  if (stage) params.set('stage', stage)
  if (search) params.set('search', search)
  const url = `/api/leads${params.toString() ? `?${params}` : ''}`
  // Realtime is handled by useRealtimeSync()
  return useQuery({
    queryKey: ['leads', stage, search],
    queryFn: () => apiFetch(url),
    staleTime: 20_000,
    refetchInterval: false,        // realtime via useRealtimeSync() covers updates
    refetchOnWindowFocus: false,
  })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: object) => apiMutate('/api/leads', 'POST', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string; [key: string]: any }) => apiMutate('/api/leads', 'PATCH', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}

export function useDeleteLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/leads?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Delete failed')
      return json
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}

// Runs AI scoring on a single lead on demand (manually added, CSV imported, etc.)
export function useAnalyzeLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (lead_id: string) =>
      apiMutate('/api/leads/analyze', 'POST', { lead_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

// Bulk re-scores multiple leads sequentially (up to 20)
export function useBulkAnalyzeLeads() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (leadIds: string[]) => {
      const results: { lead_id: string; ai_score?: number; error?: string }[] = []
      // Run sequentially to avoid rate-limiting the AI provider
      for (const lead_id of leadIds.slice(0, 20)) {
        try {
          const data = await apiMutate('/api/leads/analyze', 'POST', { lead_id })
          results.push({ lead_id, ai_score: data?.ai_score })
        } catch (err: any) {
          results.push({ lead_id, error: err.message })
        }
      }
      return results
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

// ─── Tasks ────────────────────────────────────────────────────
export function useTasks(status?: string) {
  const url = `/api/tasks${status ? `?status=${status}` : ''}`
  // Realtime is handled by useRealtimeSync()
  return useQuery({
    queryKey: ['tasks', status],
    queryFn: () => apiFetch(url),
    staleTime: 15_000,
    refetchInterval: false,        // realtime via useRealtimeSync() covers updates
    refetchOnWindowFocus: false,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: object) => apiMutate('/api/tasks', 'POST', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string; [key: string]: any }) => apiMutate('/api/tasks', 'PATCH', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Delete failed')
      return json
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

// ─── Analytics ────────────────────────────────────────────────
export function useAnalytics() {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: () => apiFetch('/api/analytics'),
    refetchInterval: 30000,
    staleTime: 10000,
  })
}

// ─── Agents ──────────────────────────────────────────────────
export function useAgents() {
  return useQuery({ queryKey: ['agents'], queryFn: () => apiFetch('/api/agents') })
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: object) => apiMutate('/api/agents', 'POST', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })
}

export function useUpdateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string; [key: string]: any }) => apiMutate('/api/agents', 'PATCH', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })
}

export function useDeleteAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/agents?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Delete failed')
      return json
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })
}

export function useTestAgent() {
  return useMutation({
    mutationFn: (data: object) => apiMutate('/api/agents', 'PUT', data),
  })
}

// ─── Workflows ────────────────────────────────────────────────
export function useWorkflows() {
  return useQuery({ queryKey: ['workflows'], queryFn: () => apiFetch('/api/workflows') })
}

export function useCreateWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: object) => apiMutate('/api/workflows', 'POST', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  })
}

export function useUpdateWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string; [key: string]: any }) => apiMutate('/api/workflows', 'PATCH', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  })
}

export function useDeleteWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/workflows?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Delete failed')
      return json
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  })
}

// ─── Campaigns ───────────────────────────────────────────────
export function useCampaigns() {
  // Realtime is handled by useRealtimeSync()
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: () => apiFetch('/api/campaigns'),
    staleTime: 20_000,
    refetchInterval: false,        // realtime via useRealtimeSync() covers updates
    refetchOnWindowFocus: false,
  })
}

export function useCreateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: object) => apiMutate('/api/campaigns', 'POST', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })
}

export function useUpdateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string; [key: string]: any }) => apiMutate('/api/campaigns', 'PATCH', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })
}

export function useDeleteCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/campaigns?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Delete failed')
      return json
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })
}

export function useCSVImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/leads/import', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Import failed')
      return json
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useCSVExport() {
  return useMutation({
    mutationFn: async ({ stage, search }: { stage?: string; search?: string } = {}) => {
      const params = new URLSearchParams()
      if (stage) params.set('stage', stage)
      if (search) params.set('search', search)
      const res = await fetch(`/api/leads/export${params.toString() ? `?${params}` : ''}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leads-${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    },
  })
}

// ─── Appointments ─────────────────────────────────────────────
export function useAppointments(upcoming?: boolean) {
  return useQuery({
    queryKey: ['appointments', upcoming],
    queryFn: () => apiFetch(`/api/appointments${upcoming ? '?upcoming=true' : ''}`),
    refetchInterval: 30000,
  })
}

export function useCreateAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: object) => apiMutate('/api/appointments', 'POST', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  })
}

export function useUpdateAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string; [key: string]: any }) => apiMutate('/api/appointments', 'PATCH', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  })
}
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
    enabled: false,
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
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Delete failed')
      return json
    },
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
    refetchInterval: 60_000,
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
    refetchInterval: 5 * 60_000,
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
export function useUsageLimits(orgId = '00000000-0000-0000-0000-000000000001') {
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
    refetchInterval: 30_000,
    retry: 1,              // don't spam retries if table missing
    retryDelay: 5_000,
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
  return useMutation({
    mutationFn: (contactId: string) =>
      apiMutate('/api/memory', 'POST', { contact_id: contactId }),
  })
}

// ── Outreach: launch AI qualification campaign to a set of leads ─────────────
export function useLeadOutreach() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      lead_ids: string[]
      message?: string
      use_template?: boolean
      template_name?: string
      template_language?: string
    }) => {
      const res = await fetch('/api/leads/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Outreach failed')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}
