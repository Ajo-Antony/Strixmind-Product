// ─── Agent Types ──────────────────────────────────────────────────────────────

export type AgentName =
  | 'research'
  | 'crm'
  | 'outreach'
  | 'memory'
  | 'analytics'
  | 'validation'

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'retry'

export interface AgentTask {
  id: string
  agent: AgentName
  input: Record<string, any>
  priority: number          // 1 = highest
  retries: number
  maxRetries: number
  status: TaskStatus
  result?: any
  error?: string
  createdAt: Date
  updatedAt: Date
}

export interface AgentResult {
  agent: AgentName
  taskId: string
  output: any
  tokensUsed?: number
  latencyMs: number
  reflectionPassed?: boolean
}

export interface PlanStep {
  agent: AgentName
  reason: string
  input: Record<string, any>
  dependsOn?: string[]      // task IDs this step waits for
}

export interface OrchestratorInput {
  conversationId: string
  userMessage: string
  history: { role: 'user' | 'assistant'; content: string }[]
  contactName?: string
  leadContext?: string
  model?: string
  provider?: string
}

export interface OrchestratorOutput {
  reply: string
  summary?: string
  tasksCreated?: AgentTask[]
  reflectionLog?: string[]
  totalTokens?: number
  latencyMs: number
}
