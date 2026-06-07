'use client'
import { useState } from 'react'
import { useKnowledgeDocuments, useAddKnowledge, useDeleteKnowledge } from '@/lib/hooks'
import { BookOpen, Plus, Trash2, Loader2, Search, Tag, X, Brain } from 'lucide-react'
import { toast } from 'sonner'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/6 ${className}`} />
}

const CATEGORIES = ['General', 'Products', 'Pricing', 'Policies', 'FAQ', 'Bridal', 'Custom Orders', 'Care Instructions']

export default function KnowledgeBase() {
  const [category, setCategory] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', category: 'General' })

  const { data: docs, isLoading } = useKnowledgeDocuments(category)
  const addDoc = useAddKnowledge()
  const deleteDoc = useDeleteKnowledge()

  const filtered = (docs ?? []).filter((d: any) =>
    !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.content.toLowerCase().includes(search.toLowerCase())
  )

  async function handleAdd() {
    if (!form.title.trim() || !form.content.trim()) return toast.error('Title and content are required')
    try {
      await addDoc.mutateAsync(form)
      setForm({ title: '', content: '', category: 'General' })
      setShowAdd(false)
      toast.success('Document added to knowledge base')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to add document')
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return
    try {
      await deleteDoc.mutateAsync(id)
      toast.success('Document deleted')
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass rounded-3xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)' }}>
            <BookOpen className="w-4 h-4" style={{ color: '#8b5cf6' }} />
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Knowledge Base</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>RAG context for AI replies</div>
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)' }}>
          <Plus className="w-3.5 h-3.5" />
          Add document
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="glass rounded-3xl p-5 space-y-3" style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New Document</div>
            <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg hover:bg-black/5">
              <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Document title (e.g. Silk Saree Care Guide)"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
          <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-secondary)' }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            placeholder="Document content — this will be used by the AI to answer customer questions..."
            rows={5}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={addDoc.isPending || !form.title || !form.content}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)' }}>
              {addDoc.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add to knowledge base
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Category filter + search */}
      <div className="glass rounded-3xl p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-[180px]"
          style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
          <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents…"
            className="flex-1 bg-transparent text-xs outline-none" style={{ color: 'var(--text-primary)' }} />
        </div>
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setCategory(undefined)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
            style={{ background: !category ? 'rgba(139,92,246,0.12)' : 'rgba(0,0,0,0.03)', color: !category ? '#7c3aed' : 'var(--text-muted)' }}>
            All
          </button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(category === c ? undefined : c)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
              style={{ background: category === c ? 'rgba(139,92,246,0.12)' : 'rgba(0,0,0,0.03)', color: category === c ? '#7c3aed' : 'var(--text-muted)' }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Document list */}
      <div className="glass rounded-3xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="w-8 h-8 mb-3 opacity-20" />
            <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              {search ? 'No documents match your search' : 'No documents yet'}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Add documents to give your AI context for answering customer questions
            </div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
            {filtered.map((doc: any) => (
              <div key={doc.id} className="p-4 hover:bg-black/[0.01] transition-all group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{doc.title}</div>
                      {doc.tags?.length > 0 && doc.tags.map((t: string) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0"
                          style={{ background: 'rgba(139,92,246,0.08)', color: '#7c3aed' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                    {doc.source && (
                      <div className="flex items-center gap-1 mb-1.5">
                        <Tag className="w-2.5 h-2.5" style={{ color: 'var(--text-muted)' }} />
                        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{doc.source}</span>
                      </div>
                    )}
                    <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{doc.content}</p>
                    <div className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                      Added {new Date(doc.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg" style={{ background: doc.active ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.04)' }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: doc.active ? '#22c55e' : '#94a3b8' }} />
                      <span className="text-[10px] font-medium" style={{ color: doc.active ? '#166534' : 'var(--text-muted)' }}>
                        {doc.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <button onClick={() => handleDelete(doc.id, doc.title)}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RAG info callout */}
      <div className="glass rounded-3xl p-4 flex items-start gap-3" style={{ border: '1px solid rgba(139,92,246,0.1)', background: 'rgba(139,92,246,0.02)' }}>
        <Brain className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#8b5cf6' }} />
        <div>
          <div className="text-xs font-semibold mb-1" style={{ color: '#7c3aed' }}>How RAG works</div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            When the AI replies to a customer, it searches these documents for relevant context before generating a response. The more specific and detailed your documents, the more accurate your AI replies will be. Aim for concise, factual content.
          </div>
        </div>
      </div>
    </div>
  )
}
