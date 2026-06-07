'use client'
import { useState, useRef, useEffect } from 'react'
import { useConversations, useMessages, useSendMessage, useUpdateConversation, useHandoff, useResumeAI } from '@/lib/hooks'
import { cn, getInitials, formatTime, scoreColor, PRIORITY_COLORS } from '@/lib/utils'
import { Send, Sparkles, Search, Check, CheckCheck, Loader2, StickyNote, Brain, UserCheck, BotOff, Bot } from 'lucide-react'
import { toast } from 'sonner'
import { AISuggestions } from './AISuggestions'

const STATUS_TABS = ['all', 'open', 'waiting', 'resolved']
const SENTIMENT_COLOR: Record<string, string> = { positive: '#22c55e', neutral: '#94a3b8', negative: '#f87171' }

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/6 ${className}`} />
}

function ConvItem({ conv, active, onClick }: { conv: any; active: boolean; onClick: () => void }) {
  const p = PRIORITY_COLORS[conv.priority] ?? PRIORITY_COLORS.medium
  return (
    <button onClick={onClick} className="w-full text-left p-3 rounded-2xl transition-all mb-1"
      style={{ background: active ? 'rgba(34,197,94,0.08)' : 'transparent', border: `1px solid ${active ? 'rgba(34,197,94,0.2)' : 'transparent'}` }}>
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold"
            style={{ background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', color: '#166534' }}>
            {getInitials(conv.contact?.name ?? conv.contact?.phone)}
          </div>
          {conv.unread_count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] flex items-center justify-center text-white font-bold"
              style={{ background: '#22c55e' }}>{conv.unread_count > 9 ? '9+' : conv.unread_count}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-0.5">
            <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {conv.contact?.name ?? conv.contact?.phone ?? 'Unknown'}
            </span>
            <span className="text-[10px] flex-shrink-0 ml-1" style={{ color: 'var(--text-muted)' }}>{formatTime(conv.last_message_at)}</span>
          </div>
          <div className="text-[11px] truncate mb-1.5" style={{ color: 'var(--text-muted)' }}>{conv.last_message_preview ?? '…'}</div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: p.bg, color: p.text }}>{conv.priority}</span>
            {conv.ai_score > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(34,197,94,0.08)', color: '#166634' }}>
                AI {conv.ai_score}
              </span>
            )}
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: SENTIMENT_COLOR[conv.sentiment ?? 'neutral'] }} />
          </div>
        </div>
      </div>
    </button>
  )
}

function MessageBubble({ msg }: { msg: any }) {
  const isInbound = msg.direction === 'inbound'
  const isOutreach = msg.metadata?.outreach === true
  if (msg.type === 'note') {
    return (
      <div className="flex justify-center my-2">
        <div className="max-w-[85%] px-4 py-2 rounded-2xl text-[11px] leading-relaxed flex items-start gap-2"
          style={{ background: 'rgba(34,197,94,0.06)', border: '1px dashed rgba(34,197,94,0.2)', color: '#166534' }}>
          <StickyNote className="w-3 h-3 mt-0.5 flex-shrink-0" /><span>{msg.content}</span>
        </div>
      </div>
    )
  }
  return (
    <div className={cn('flex mb-3', isInbound ? 'justify-start' : 'justify-end')}>
      <div className="max-w-[75%]">
        <div className="px-4 py-2.5 rounded-2xl text-[12.5px] leading-relaxed"
          style={{
            background: isInbound ? 'rgba(255,255,255,0.85)' : 'linear-gradient(135deg,#166534,#22c55e)',
            border: isInbound ? '1px solid rgba(0,0,0,0.06)' : 'none',
            color: isInbound ? 'var(--text-primary)' : 'white',
          }}>
          {msg.sender_type === 'ai' && !isInbound && (
            <div className="flex items-center gap-1 mb-1 opacity-70">
              {isOutreach
                ? <><Brain className="w-2.5 h-2.5" /><span className="text-[10px]">Agent Outreach{msg.metadata?.agent_name ? ` · ${msg.metadata.agent_name}` : ''}</span></>
                : <><Sparkles className="w-2.5 h-2.5" /><span className="text-[10px]">AI Draft</span></>
              }
            </div>
          )}
          {msg.content}
        </div>
        <div className={cn('flex items-center gap-1 mt-0.5 px-1', isInbound ? '' : 'justify-end')}>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {new Date(msg.wa_timestamp ?? msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isInbound && (msg.status === 'read'
            ? <CheckCheck className="w-3 h-3 text-emerald-500" />
            : msg.status === 'delivered'
              ? <CheckCheck className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
              : <Check className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />)}
        </div>
      </div>
    </div>
  )
}

export default function Inbox() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [showAI, setShowAI] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: conversations, isLoading: convsLoading } = useConversations(filter)
  const { data: messages, isLoading: msgsLoading } = useMessages(selectedId)
  const sendMessage = useSendMessage()
  const updateConv = useUpdateConversation()
  const handoff = useHandoff()
  const resumeAI = useResumeAI()

  const filtered = (conversations ?? []).filter((c: any) => {
    if (!search) return true
    return (c.contact?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.contact?.phone ?? '').includes(search) ||
      (c.last_message_preview ?? '').toLowerCase().includes(search.toLowerCase())
  })

  const selectedConv = (conversations ?? []).find((c: any) => c.id === selectedId)

  useEffect(() => { if (!selectedId && filtered.length) setSelectedId(filtered[0].id) }, [filtered.length])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    if (selectedId && selectedConv?.unread_count > 0) updateConv.mutate({ id: selectedId, unread_count: 0 })
  }, [selectedId])

  async function handleSend() {
    if (!reply.trim() || !selectedId) return
    const text = reply.trim()
    setReply('')
    try {
      await sendMessage.mutateAsync({ conversation_id: selectedId, content: text })
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send')
      setReply(text)
    }
  }

  return (
    <div className="flex gap-3 overflow-hidden" style={{ height: 'calc(100vh - 84px)' }}>
      {/* List panel */}
      <div className="glass rounded-3xl flex flex-col overflow-hidden" style={{ width: 284, flexShrink: 0 }}>
        <div className="p-3 border-b" style={{ borderColor: 'rgba(34,197,94,0.08)' }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="flex-1 bg-transparent text-xs outline-none" style={{ color: 'var(--text-primary)' }} />
          </div>
        </div>
        <div className="px-3 py-2 border-b flex gap-1" style={{ borderColor: 'rgba(34,197,94,0.08)' }}>
          {STATUS_TABS.map(s => (
            <button key={s} onClick={() => setFilter(s)} className="flex-1 py-1.5 rounded-xl text-[11px] font-medium capitalize transition-all"
              style={{ background: filter === s ? 'rgba(34,197,94,0.12)' : 'transparent', color: filter === s ? '#166534' : 'var(--text-muted)' }}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {convsLoading ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full mb-2" />) :
            filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
                <div className="text-3xl mb-2">💬</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {search ? 'No conversations match' : 'No conversations yet.\nWhatsApp messages will appear here automatically.'}
                </div>
              </div>
            ) : filtered.map((c: any) => <ConvItem key={c.id} conv={c} active={c.id === selectedId} onClick={() => setSelectedId(c.id)} />)
          }
        </div>
      </div>

      {/* Chat panel */}
      {selectedConv ? (
        <div className="glass rounded-3xl flex flex-col flex-1 overflow-hidden min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0" style={{ borderColor: 'rgba(34,197,94,0.08)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', color: '#166534' }}>
                {getInitials(selectedConv.contact?.name ?? selectedConv.contact?.phone)}
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {selectedConv.contact?.name ?? selectedConv.contact?.phone ?? 'Unknown'}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {selectedConv.contact?.phone} · <span style={{ color: SENTIMENT_COLOR[selectedConv.sentiment ?? 'neutral'] }}>{selectedConv.sentiment}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedConv.ai_score > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                  style={{ background: `${scoreColor(selectedConv.ai_score)}15`, color: scoreColor(selectedConv.ai_score) }}>
                  AI {selectedConv.ai_score}
                </span>
              )}
              {/* AI auto-reply toggle */}
              {selectedConv.ai_auto_reply ? (
                <button
                  onClick={async () => {
                    try {
                      await handoff.mutateAsync({
                        conversation_id: selectedConv.id,
                        draft_reply: '',
                        user_message: selectedConv.last_message_preview ?? '',
                        contact_phone: selectedConv.contact?.phone ?? '',
                      })
                      toast.success('Conversation handed off to human agent')
                    } catch (e: any) { toast.error(e.message ?? 'Handoff failed') }
                  }}
                  disabled={handoff.isPending}
                  title="Take over (disable AI auto-reply)"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all"
                  style={{ background: 'rgba(59,130,246,0.08)', color: '#2563eb' }}>
                  {handoff.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                  Take over
                </button>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      await resumeAI.mutateAsync({ conversation_id: selectedConv.id, resume_ai: true })
                      toast.success('AI auto-reply resumed')
                    } catch (e: any) { toast.error(e.message ?? 'Resume failed') }
                  }}
                  disabled={resumeAI.isPending}
                  title="Resume AI auto-reply"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all"
                  style={{ background: 'rgba(34,197,94,0.08)', color: '#166534' }}>
                  {resumeAI.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                  Resume AI
                </button>
              )}
              <select value={selectedConv.status}
                onChange={e => updateConv.mutate({ id: selectedConv.id, status: e.target.value })}
                className="text-[11px] px-2 py-1.5 rounded-xl outline-none cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-secondary)' }}>
                <option value="open">Open</option>
                <option value="waiting">Waiting</option>
                <option value="resolved">Resolved</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {msgsLoading ? (
              <div className="space-y-3">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
                    <Skeleton className={cn('h-12 rounded-2xl', i % 2 === 0 ? 'w-56' : 'w-44')} />
                  </div>
                ))}
              </div>
            ) : (messages ?? []).length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--text-muted)' }}>No messages yet</div>
            ) : (messages ?? []).map((m: any) => <MessageBubble key={m.id} msg={m} />)}
            <div ref={bottomRef} />
          </div>

          {/* AI suggestions panel + Reply bar */}
          <div className="flex-shrink-0 relative z-10">
            {showAI && selectedId && (
              <div className="px-4 pt-2 pb-1">
                <AISuggestions convId={selectedId} onUse={t => { setReply(t); setShowAI(false) }} />
              </div>
            )}

            {/* Reply bar */}
            <div className="px-4 pb-4">
              <div className="flex items-end gap-2 p-3 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(34,197,94,0.12)' }}>
                <textarea value={reply} onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder="Type a message… (Enter to send)" rows={2}
                  className="flex-1 bg-transparent text-xs outline-none resize-none"
                  style={{ color: 'var(--text-primary)', minHeight: 40, maxHeight: 120 }} />
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => setShowAI(!showAI)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                    style={{ background: showAI ? 'rgba(34,197,94,0.12)' : 'rgba(0,0,0,0.04)', color: showAI ? '#22c55e' : 'var(--text-muted)' }}
                    title="AI suggestions">
                    <Sparkles className="w-4 h-4" />
                  </button>
                  <button onClick={handleSend} disabled={!reply.trim() || sendMessage.isPending}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all hover:opacity-90 disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}>
                    {sendMessage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>{/* end AI panel + reply bar wrapper */}
        </div>
      ) : (
        <div className="glass rounded-3xl flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-3">💬</div>
            <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Select a conversation</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>WhatsApp messages appear here in realtime</div>
          </div>
        </div>
      )}

      {/* Right: contact detail */}
      {selectedConv && (
        <div className="glass rounded-3xl p-4 overflow-y-auto hidden xl:flex flex-col" style={{ width: 224, flexShrink: 0 }}>
          <div className="text-center mb-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold mx-auto mb-2"
              style={{ background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', color: '#166534' }}>
              {getInitials(selectedConv.contact?.name ?? selectedConv.contact?.phone)}
            </div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedConv.contact?.name ?? 'Unknown'}</div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{selectedConv.contact?.phone}</div>
          </div>
          {selectedConv.ai_summary && (
            <div className="p-3 rounded-2xl mb-3" style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.08)' }}>
              <div className="text-[10px] font-semibold mb-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                <Sparkles className="w-2.5 h-2.5 text-emerald-500" /> AI SUMMARY
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{selectedConv.ai_summary}</p>
            </div>
          )}
          <div className="space-y-1.5 mt-auto">
            {/* AI status */}
            <div className="flex items-center justify-between px-2 py-1.5 rounded-xl mb-1"
              style={{ background: selectedConv.ai_auto_reply ? 'rgba(34,197,94,0.06)' : 'rgba(100,116,139,0.06)', border: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="flex items-center gap-1.5">
                {selectedConv.ai_auto_reply ? <Bot className="w-3 h-3" style={{ color: '#22c55e' }} /> : <BotOff className="w-3 h-3" style={{ color: '#94a3b8' }} />}
                <span className="text-[10px] font-medium" style={{ color: selectedConv.ai_auto_reply ? '#166534' : '#64748b' }}>
                  AI {selectedConv.ai_auto_reply ? 'active' : 'paused'}
                </span>
              </div>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: selectedConv.ai_auto_reply ? '#22c55e' : '#94a3b8' }} />
            </div>
            <button onClick={() => updateConv.mutate({ id: selectedConv.id, priority: 'urgent' })}
              className="w-full py-2 rounded-xl text-xs font-medium" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
              Mark Urgent
            </button>
            <button onClick={() => updateConv.mutate({ id: selectedConv.id, status: 'resolved' })}
              className="w-full py-2 rounded-xl text-xs font-medium" style={{ background: 'rgba(34,197,94,0.08)', color: '#166534' }}>
              Resolve
            </button>
          </div>
        </div>
      )}
    </div>
  )
}