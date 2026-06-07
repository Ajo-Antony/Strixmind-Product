'use client'
import { useState } from 'react'
import { useTasks, useUpdateTask, useCreateTask, useDeleteTask } from '@/lib/hooks'
import { formatTime, PRIORITY_COLORS } from '@/lib/utils'
import { CheckCircle, Circle, MinusCircle, Plus, Sparkles, Clock, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/6 ${className}`} />
}

function TaskCard({ task, onToggle, onDelete }: { task: any; onToggle: () => void; onDelete: () => void }) {
  const p = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.medium
  const isDone = task.status === 'done'
  const isInProgress = task.status === 'in_progress'
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isDone

  return (
    <div className="flex items-start gap-3 p-3.5 rounded-2xl mb-2 group transition-all hover:shadow-sm"
      style={{
        background: 'rgba(255,255,255,0.78)',
        border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.2)' : 'rgba(0,0,0,0.06)'}`,
        opacity: isDone ? 0.6 : 1,
      }}>
      <button onClick={onToggle} className="flex-shrink-0 mt-0.5 hover:scale-110 transition-transform" title={isDone ? 'Mark pending' : isInProgress ? 'Mark done' : 'Start task'}>
        {isDone
          ? <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} />
          : isInProgress
          ? <MinusCircle className="w-4 h-4" style={{ color: '#3b82f6' }} />
          : <Circle className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-xs leading-snug mb-1.5 ${isDone ? 'line-through' : ''}`} style={{ color: 'var(--text-primary)' }}>
          {task.title}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: p.bg, color: p.text }}>
            {task.priority}
          </span>
          {task.lead?.name && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.08)', color: '#166534' }}>
              {task.lead.name}
            </span>
          )}
          {task.ai_generated && (
            <span className="text-[10px] flex items-center gap-0.5" style={{ color: '#22c55e' }}>
              <Sparkles className="w-2.5 h-2.5" /> AI
            </span>
          )}
          {task.due_date && (
            <span className={`text-[10px] flex items-center gap-0.5`}
              style={{ color: isOverdue ? '#dc2626' : 'var(--text-muted)' }}>
              <Clock className="w-2.5 h-2.5" />
              {isOverdue ? 'Overdue · ' : ''}{formatTime(task.due_date)}
            </span>
          )}
        </div>
        {task.ai_reasoning && (
          <div className="text-[10px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {task.ai_reasoning}
          </div>
        )}
      </div>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 transition-all flex-shrink-0">
        <Trash2 className="w-3 h-3" style={{ color: '#dc2626' }} />
      </button>
    </div>
  )
}

function AddTaskModal({ onClose }: { onClose: () => void }) {
  const create = useCreateTask()
  const [form, setForm] = useState({ title: '', priority: 'medium', due_date: '', description: '' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  async function submit() {
    if (!form.title) return toast.error('Title required')
    try {
      await create.mutateAsync({ ...form, status: 'pending', due_date: form.due_date || null })
      toast.success('Task created')
      onClose()
    } catch (err: any) { toast.error(err.message) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}>
      <div className="glass rounded-3xl p-6 w-full max-w-sm">
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>New Task</h2>
        <div className="space-y-3">
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Task title *"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
          <select value={form.priority} onChange={e => set('priority', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }}>
            {['low','medium','high','urgent'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
          </select>
          <input type="datetime-local" value={form.due_date} onChange={e => set('due_date', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Description (optional)"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }} />
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={submit} disabled={create.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm text-white font-medium flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}>
            {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Create
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Tasks() {
  const [showAdd, setShowAdd] = useState(false)
  const { data: tasks, isLoading } = useTasks()
  const update = useUpdateTask()
  const deleteFn = useDeleteTask()

  const byStatus = {
    pending: (tasks ?? []).filter((t: any) => t.status === 'pending'),
    in_progress: (tasks ?? []).filter((t: any) => t.status === 'in_progress'),
    done: (tasks ?? []).filter((t: any) => t.status === 'done'),
  }

  const toggle = async (task: any) => {
    const next = task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'pending'
    try { await update.mutateAsync({ id: task.id, status: next }) }
    catch (err: any) { toast.error(err.message) }
  }

  const del = async (id: string) => {
    try { await deleteFn.mutateAsync(id); toast.success('Deleted') }
    catch (err: any) { toast.error(err.message) }
  }

  const cols = [
    { key: 'pending', label: 'Pending', color: '#f59e0b', tasks: byStatus.pending },
    { key: 'in_progress', label: 'In Progress', color: '#3b82f6', tasks: byStatus.in_progress },
    { key: 'done', label: 'Completed', color: '#22c55e', tasks: byStatus.done },
  ]

  return (
    <div>
      {showAdd && <AddTaskModal onClose={() => setShowAdd(false)} />}
      <div className="flex justify-between items-center mb-4">
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {(tasks ?? []).filter((t: any) => t.status !== 'done').length} open · {(tasks ?? []).filter((t: any) => t.ai_generated).length} AI-generated
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white"
          style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}>
          <Plus className="w-3.5 h-3.5" /> New Task
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {cols.map(col => (
          <div key={col.key} className="glass rounded-3xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{col.label}</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${col.color}15`, color: col.color }}>
                {col.tasks.length}
              </span>
            </div>
            {isLoading ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full mb-2" />) :
              col.tasks.length === 0 ? (
                <div className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>No tasks</div>
              ) : col.tasks.map((t: any) => (
                <TaskCard key={t.id} task={t} onToggle={() => toggle(t)} onDelete={() => del(t.id)} />
              ))
            }
          </div>
        ))}
      </div>
    </div>
  )
}
