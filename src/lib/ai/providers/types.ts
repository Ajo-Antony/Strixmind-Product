// ─── Shared AI Provider Types ────────────────────────────────────────────────

export type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'cohere'
export type ModelSize = 'small' | 'large'

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AIRequestOptions {
  provider?: ProviderName
  model?: string
  size?: ModelSize
  systemPrompt: string
  messages: AIMessage[]
  temperature?: number
  maxTokens?: number
  taskType: string
  conversationId?: string
  leadId?: string
  responseFormat?: 'text' | 'json'
  stream?: boolean
}

export interface AIResponse {
  text: string
  provider: string
  model: string
  promptTokens: number
  completionTokens: number
  latencyMs: number
}

export interface ProviderConfig {
  name: ProviderName
  label: string
  description: string
  models: ModelDefinition[]
  envKey: string
  docsUrl: string
  color: string
  icon: string
}

export interface ModelDefinition {
  id: string
  label: string
  size: ModelSize
  contextWindow: number
  description: string
}

export interface ProviderTestResult {
  success: boolean
  latencyMs: number
  model: string
  error?: string
  response?: string
}
