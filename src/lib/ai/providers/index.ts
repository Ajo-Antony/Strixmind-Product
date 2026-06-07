// ─── AI Providers — Public API ────────────────────────────────────────────────
export * from './types'
export * from './cohere'
export * from './router'

import type { ProviderConfig } from './types'

/** Static metadata about each supported provider (UI use) */
export const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    name: 'openai',
    label: 'OpenAI',
    description: 'GPT-4o and GPT-4o-mini — industry standard models',
    envKey: 'OPENAI_API_KEY',
    docsUrl: 'https://platform.openai.com/api-keys',
    color: '#10a37f',
    icon: '🟢',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', size: 'small', contextWindow: 128000, description: 'Fast & affordable' },
      { id: 'gpt-4o',      label: 'GPT-4o',      size: 'large', contextWindow: 128000, description: 'Most capable' },
    ],
  },
  {
    name: 'anthropic',
    label: 'Anthropic',
    description: 'Claude models — nuanced reasoning and safety',
    envKey: 'ANTHROPIC_API_KEY',
    docsUrl: 'https://console.anthropic.com/keys',
    color: '#d97706',
    icon: '🟠',
    models: [
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku',  size: 'small', contextWindow: 200000, description: 'Ultra-fast' },
      { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet', size: 'large', contextWindow: 200000, description: 'Balanced power' },
    ],
  },
  {
    name: 'gemini',
    label: 'Google Gemini',
    description: 'Gemini 2.0 Flash and 2.5 Pro — Google\'s multimodal models',
    envKey: 'GEMINI_API_KEY',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    color: '#4285f4',
    icon: '🔵',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', size: 'small', contextWindow: 1000000, description: 'Fastest response' },
      { id: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro',   size: 'large', contextWindow: 1000000, description: 'Largest context' },
    ],
  },
  {
    name: 'cohere',
    label: 'Cohere',
    description: 'Command R and Command R+ — enterprise-grade RAG models',
    envKey: 'COHERE_API_KEY',
    docsUrl: 'https://dashboard.cohere.com/api-keys',
    color: '#39d353',
    icon: '⚡',
    models: [
      { id: 'command-a-03-2025',      label: 'Command A',        size: 'large', contextWindow: 256000, description: 'Most powerful — best for agents & RAG' },
      { id: 'command-r-plus-08-2024', label: 'Command R+ 08-24', size: 'large', contextWindow: 128000, description: 'Strong reasoning & tool use' },
      { id: 'command-r-08-2024',      label: 'Command R 08-24',  size: 'small', contextWindow: 128000, description: 'Fast & efficient' },
    ],
  },
]
