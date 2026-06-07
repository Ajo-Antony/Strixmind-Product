// ─── Task Queue ───────────────────────────────────────────────────────────────
// In-process priority queue. Swap the executor for a real queue
// (BullMQ, Inngest, Upstash) when you need persistence across restarts.

import type { AgentTask, AgentName, TaskStatus } from './types'

type Executor = (task: AgentTask) => Promise<any>

const RETRY_DELAY_MS = 500

export class TaskQueue {
  private queue: AgentTask[] = []
  private executors: Map<AgentName, Executor> = new Map()
  private trace: { taskId: string; event: string; ts: number; data?: any }[] = []

  register(agent: AgentName, executor: Executor) {
    this.executors.set(agent, executor)
  }

  enqueue(task: Omit<AgentTask, 'id' | 'status' | 'retries' | 'createdAt' | 'updatedAt'>): AgentTask {
    const full: AgentTask = {
      ...task,
      id: crypto.randomUUID(),
      status: 'pending',
      retries: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.queue.push(full)
    this.queue.sort((a, b) => a.priority - b.priority)
    this._log(full.id, 'enqueued', { agent: full.agent })
    return full
  }

  async runAll(): Promise<AgentTask[]> {
    const results: AgentTask[] = []

    while (this.queue.length > 0) {
      const task = this.queue.shift()!
      const executor = this.executors.get(task.agent)

      if (!executor) {
        task.status = 'failed'
        task.error = `No executor registered for agent: ${task.agent}`
        task.updatedAt = new Date()
        this._log(task.id, 'failed', { error: task.error })
        results.push(task)
        continue
      }

      task.status = 'running'
      task.updatedAt = new Date()
      this._log(task.id, 'started')

      const start = Date.now()
      try {
        task.result = await executor(task)
        task.status = 'done'
        task.updatedAt = new Date()
        this._log(task.id, 'done', { latencyMs: Date.now() - start })
      } catch (err: any) {
        if (task.retries < task.maxRetries) {
          task.retries++
          task.status = 'retry'
          task.updatedAt = new Date()
          this._log(task.id, 'retry', { attempt: task.retries })
          await this._delay(RETRY_DELAY_MS * task.retries)
          this.queue.unshift(task)    // push back to front
          continue
        }
        task.status = 'failed'
        task.error = err?.message ?? 'Unknown error'
        task.updatedAt = new Date()
        this._log(task.id, 'failed', { error: task.error })
      }

      results.push(task)
    }

    return results
  }

  getTrace() { return this.trace }

  private _log(taskId: string, event: string, data?: any) {
    this.trace.push({ taskId, event, ts: Date.now(), data })
  }

  private _delay(ms: number) {
    return new Promise(r => setTimeout(r, ms))
  }
}
