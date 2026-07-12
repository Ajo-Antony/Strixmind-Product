'use client'
import { useState, useEffect } from 'react'
import { useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent, useTestAgent } from '@/lib/hooks'
import { 
  Brain, Plus, Trash2, Play, Loader2, CheckCircle, XCircle, Edit2,
  Sparkles, MessageSquare, Send, Calendar, Check, AlertCircle, 
  RefreshCw, Smartphone, ChevronRight, Info, ShieldAlert, Heart, HelpCircle
} from 'lucide-react'
import { toast } from 'sonner'

const PROVIDERS = ['openai', 'anthropic', 'gemini', 'cohere']
const MODELS: Record<string, string[]> = {
  openai:    ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  gemini:    ['gemini-1.5-pro', 'gemini-1.5-flash'],
  cohere:    ['command-a-03-2025', 'command-r-plus-08-2024', 'command-r-08-2024'],
}

// PREMIUM AGENT BLUEPRINTS FOR NON-TECHNICAL CRM USERS
const SYSTEM_PRESETS = [
  {
    name: "🌸 Bridal Stylist & Qualifier",
    badge: "Most Popular",
    description: "Qualifies bridal saree and luxury couture leads. Extracts: Budget, Occasion, Wedding Date.",
    form: {
      name: "Bridal Stylist Agent",
      description: "Qualifies high-end bridal & couture leads.",
      provider: "gemini",
      model: "gemini-1.5-flash",
      temperature: "0.6",
      max_tokens: "800",
      system_prompt: `You are an expert sales stylist assistant for StrixMind, a premium bridal and couture fashion boutique.

Your goal is to warmly qualify incoming WhatsApp leads and help them book an exclusive boutique consultation.
Ask one focused question at a time.
Verify:
1. Occasion type (Bridal saree, bridesmaid gown, reception wear)
2. Wedding/Event date (timeline urgency)
3. Budget range (e.g., INR 50k - 1 Lakh, 1 Lakh - 3 Lakh)
4. Style preferences (Traditional silk sarees, modern embroidered lehengas)

Keep responses professional, warm, and highly personalized. Use emojis naturally.`,
      active: true,
    }
  },
  {
    name: "📅 Showroom Booker",
    badge: "High Conversion",
    description: "Guides leads to confirm a physical or digital showroom styling session.",
    form: {
      name: "Showroom Consultation Booker",
      description: "Automates calendar and showroom visits.",
      provider: "gemini",
      model: "gemini-1.5-flash",
      temperature: "0.4",
      max_tokens: "600",
      system_prompt: `You are a highly efficient booking concierge agent for StrixMind boutique.

Your single focused objective is to guide leads to secure a showroom or virtual styling slot.
Acknowledge their inquiry warmly.
Ask:
1. Preferred consult mode (In-store experience at our luxury Delhi showroom, or Virtual video consultation)
2. Ideal date & time window (e.g., this coming weekend, next Tuesday afternoon)

Guide them with a call-to-action like "I can reserve our premium slot for you right now." Maintain a highly polite, executive tone.`,
      active: true,
    }
  },
  {
    name: "🔥 VIP Lead Qualifier",
    badge: "Smart Escalation",
    description: "Identifies bulk orders, high-budget shoppers, and routes to Ajo instantly.",
    form: {
      name: "VIP Custom Lead Qualifier",
      description: "Detects premium high-value custom clients.",
      provider: "gemini",
      model: "gemini-1.5-flash",
      temperature: "0.3",
      max_tokens: "600",
      system_prompt: `You are a specialized VIP Client Success manager for StrixMind.

Analyze if the customer represents a high-budget order, boutique bulk reseller, or corporate buyer.
Detect indicators:
- Ordering more than 5 pieces of couture
- Budget exceeding INR 5,000,000
- Custom collaborative designs requested

If intent or budget is high, trigger escalation by summarizing the request and saying: "I will immediately hand you over to our principal creative director Ajo for custom support."`,
      active: true,
    }
  },
  {
    name: "🙋 Policy & Alterations Guide",
    badge: "Complimentary FAQ",
    description: "Resolves common inquiries about shipping timelines, fitting alterations, and returns.",
    form: {
      name: "Policy FAQ Support Agent",
      description: "FAQ resolution and store information.",
      provider: "gemini",
      model: "gemini-1.5-flash",
      temperature: "0.2",
      max_tokens: "600",
      system_prompt: `You are a supportive and friendly FAQ Concierge for StrixMind boutique.

Provide fast, accurate answers regarding store policies:
- Delivery timeline: 3-4 weeks for custom couture, 5-7 days for ready-to-wear pieces.
- Return Policy: Custom-made orders are final sale, but we offer unlimited complimentary fitting alterations for up to 3 months.
- Shipping: Free luxury insured shipping worldwide for orders over INR 200,000.

Be concise, reassuring, and always offer additional support or general assistance if needed.`,
      active: true,
    }
  }
]

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/5 ${className}`} />
}

const DEFAULT_FORM = {
  name: 'Bridal Stylist Agent',
  description: 'Qualifies bridal & fashion leads using Google Gemini',
  provider: 'gemini',
  model: 'gemini-1.5-flash',
  system_prompt: `You are an expert sales stylist assistant for StrixMind, a premium bridal and couture fashion boutique.

Your job is to qualify incoming WhatsApp leads by understanding:
- What occasion they are shopping for (bridal saree, lehenga, gown)
- Their wedding or event timeline
- Their styling budget range
- Their general design preferences

Always be warm, empathetic, and professional — ask one focused follow-up question at a time.`,
  temperature: '0.5',
  max_tokens: '800',
  active: true,
}

export default function Agents() {
  const { data: agents, isLoading } = useAgents()
  const createAgent = useCreateAgent()
  const updateAgent = useUpdateAgent()
  const deleteAgent = useDeleteAgent()
  const testAgent = useTestAgent()

  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [testResult, setTestResult] = useState<any>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'new'>('view')

  // Interactive Live Chat States
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant', content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [typingMsg, setTypingMsg] = useState(false)

  // Auto-initialize chat when selected agent changes
  useEffect(() => {
    if (selected && mode === 'view') {
      initChat(selected)
    }
  }, [selected, mode])

  const initChat = (agent: any) => {
    setChatHistory([
      {
        role: 'assistant',
        content: `Hi! I am the ${agent.name}. How can I help you today with StrixMind's bridal & designer collection? ✨`
      }
    ])
    setChatInput('')
    setTypingMsg(false)
    setTestResult(null)
  }

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }

  function openNew() {
    setForm(DEFAULT_FORM)
    setSelected(null)
    setTestResult(null)
    setMode('new')
    setChatHistory([])
  }

  function openEdit(agent: any) {
    setSelected(agent)
    setForm({
      name: agent.name,
      description: agent.description ?? '',
      provider: agent.provider,
      model: agent.model,
      system_prompt: agent.system_prompt,
      temperature: String(agent.temperature),
      max_tokens: String(agent.max_tokens),
      active: agent.active,
    })
    setTestResult(null)
    setMode('edit')
  }

  function openView(agent: any) {
    setSelected(agent)
    setTestResult(null)
    setMode('view')
  }

  async function handleSave() {
    if (!form.name || !form.system_prompt) return toast.error('Name and system prompt required')
    const payload = {
      ...form,
      temperature: parseFloat(form.temperature),
      max_tokens: parseInt(form.max_tokens),
    }
    try {
      if (mode === 'new') {
        const created = await createAgent.mutateAsync(payload)
        toast.success('Agent created successfully!')
        openView(created)
      } else {
        const updated = await updateAgent.mutateAsync({ id: selected.id, ...payload })
        toast.success('Agent details updated!')
        openView(updated)
      }
    } catch (err: any) { toast.error(err.message) }
  }

  async function handleDelete(agent: any) {
    if (!confirm(`Delete "${agent.name}"?`)) return
    try {
      await deleteAgent.mutateAsync(agent.id)
      toast.success('Agent deleted')
      setSelected(null)
      setMode('view')
    } catch (err: any) { toast.error(err.message) }
  }

  const toggle = async (agent: any) => {
    try {
      await updateAgent.mutateAsync({ id: agent.id, active: !agent.active })
      if (selected?.id === agent.id) setSelected({ ...agent, active: !agent.active })
      toast.success(agent.active ? 'Agent deactivated' : 'Agent activated')
    } catch (err: any) { toast.error(err.message) }
  }

  const applyPreset = (preset: any) => {
    setForm({
      name: preset.form.name,
      description: preset.form.description,
      provider: preset.form.provider,
      model: preset.form.model,
      system_prompt: preset.form.system_prompt,
      temperature: String(preset.form.temperature),
      max_tokens: String(preset.form.max_tokens),
      active: preset.form.active,
    })
    toast.success(`Blueprint "${preset.name}" loaded instantly!`)
  }

  // Interactive conversation simulator
  const sendSimulatedMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!chatInput.trim() || typingMsg) return
    
    const userMsg = chatInput.trim()
    const updatedHistory = [...chatHistory, { role: 'user' as const, content: userMsg }]
    setChatHistory(updatedHistory)
    setChatInput('')
    setTypingMsg(true)

    // Build chronological chat string context for LLM response
    const contextPrompt = `You must simulate a WhatsApp chat based on your System Prompt rules.
Current conversation history:
${updatedHistory.map(m => `[${m.role === 'user' ? 'Customer' : 'Agent'}]: ${m.content}`).join('\n')}

Generate the next response as the [Agent]. Do NOT prefix with "Agent:" or "[Agent]:". Reply naturally and keep it conversational.`

    const payload = {
      provider: selected.provider,
      model: selected.model,
      system_prompt: selected.system_prompt,
      temperature: parseFloat(selected.temperature),
      test_message: contextPrompt,
    }

    try {
      const result = await testAgent.mutateAsync(payload)
      setChatHistory(prev => [...prev, { role: 'assistant' as const, content: result.response }])
      setTestResult(result)
    } catch (err: any) {
      toast.error(err.message || 'Simulation response failed')
      setChatHistory(prev => [...prev, { role: 'assistant' as const, content: `⚠️ (Simulation error: ${err.message || 'Check your Gemini/OpenAI settings key.'})` }])
    } finally {
      setTypingMsg(false)
    }
  }

  // Real-time client-side CRM parser & scoring engine
  const getSimulatedCapturedData = () => {
    let budget = 'Not detected yet'
    let date = 'Not detected yet'
    let occasion = 'Not detected yet'
    let intent = 'Analyzing text...'
    let score = 25

    const text = chatHistory.map(m => m.content).join(' ').toLowerCase()

    if (!selected) return { budget, date, occasion, intent, score: 0 }

    // Occasion detection
    if (text.includes('bridal') || text.includes('wedding') || text.includes('groom') || text.includes('marry') || text.includes('marriage')) {
      occasion = 'Bridal / Wedding 🌸'
      score += 25
    } else if (text.includes('party') || text.includes('reception') || text.includes('anniversary')) {
      occasion = 'Special Occasion 🎉'
      score += 15
    } else if (text.includes('saree') || text.includes('lehenga') || text.includes('suit') || text.includes('gown') || text.includes('dress')) {
      occasion = 'Designer Couture 🛍️'
      score += 10
    }

    // Budget extraction
    const budgetMatch = text.match(/(?:budget|price|around|limit|inr|rs\.?|between|cost)\s*(?:is|of|about)?\s*(?:rs\.?|inr)?\s*(\d+[\s,]?\d*(?:\s*(?:lakh|l|k|thousand|usd))?)/i)
    if (budgetMatch) {
      budget = budgetMatch[0].toUpperCase()
      score += 25
    } else if (text.includes('price') || text.includes('cost') || text.includes('budget') || text.includes('rate')) {
      budget = 'Requested Catalog Rates 📋'
      score += 10
    }

    // Timeline/Urgency detection
    if (text.includes('next month') || text.includes('this year') || text.includes('urgent') || text.includes('coming') || text.includes('soon') || text.includes('december') || text.includes('nov') || text.includes('wedding date')) {
      date = 'High Urgency Timeline ⏱️'
      score += 25
    }

    // Scoring intent
    if (chatHistory.length > 2) {
      score += 15
    }

    if (score >= 75) {
      intent = '🔥 Hot Lead (Ready to Book)'
    } else if (score >= 45) {
      intent = '🟡 Medium Intent'
    } else {
      intent = '⚪ Inquiring'
    }

    return { budget, date, occasion, intent, score: Math.min(100, score) }
  }

  const { budget, date, occasion, intent, score } = getSimulatedCapturedData()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* LEFT COLUMN: AGENTS MANAGER LIST */}
      <div className="glass rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold block" style={{ color: 'var(--text-primary)' }}>Your Active Agents</span>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Assigned to incoming flows</p>
            </div>
          </div>
          
          <button onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white font-semibold transition-all hover:scale-[1.02] shadow-sm"
            style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}>
            <Plus className="w-3.5 h-3.5" /> Blueprint
          </button>
        </div>

        <div className="space-y-2">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : (agents ?? []).length === 0 ? (
            <div className="text-center py-10 border border-dashed border-black/10 rounded-2xl">
              <Brain className="w-8 h-8 mx-auto mb-2 text-gray-300 animate-pulse" />
              <span className="text-[11px] block font-medium text-gray-500">No agents deployed yet</span>
              <p className="text-[10px] text-gray-400 mt-0.5 px-6">Click "+ Blueprint" to initialize an automated team member.</p>
            </div>
          ) : (
            (agents ?? []).map((agent: any) => {
              const isSelected = selected?.id === agent.id
              return (
                <button 
                  key={agent.id} 
                  onClick={() => openView(agent)}
                  className="w-full p-3.5 rounded-2xl text-left transition-all border flex items-center justify-between group relative overflow-hidden"
                  style={{
                    background: isSelected ? 'rgba(34,197,94,0.06)' : 'rgba(0,0,0,0.015)',
                    borderColor: isSelected ? 'rgba(34,197,94,0.2)' : 'rgba(0,0,0,0.04)',
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: agent.active ? '#22c55e' : '#94a3b8' }} />
                      <span className="text-xs font-bold truncate block" style={{ color: 'var(--text-primary)' }}>{agent.name}</span>
                    </div>
                    <p className="text-[10.5px] truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }}>
                      {agent.description || 'Deploys conversational automation'}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-[9.5px] font-mono px-2 py-0.5 rounded-full bg-black/5 uppercase">
                      {agent.provider}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Informative Guidance Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 text-xs text-slate-500 space-y-2 leading-relaxed">
          <div className="flex items-center gap-1 font-bold text-slate-700">
            <Info className="w-3.5 h-3.5 text-emerald-600" />
            <span>How CRM Agents Work</span>
          </div>
          <p className="text-[11px]">
            AI agents take incoming WhatsApp triggers, respond instantly using their System Prompt, and automatically qualify leads based on intent, budget, and urgency scores.
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN: ACTIVE EDITOR & MOCK SANDBOX CONTAINER */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* VIEWING SELECTED DEPLOYED AGENT & SIMULATOR */}
        {mode === 'view' && (
          !selected ? (
            <div className="glass rounded-3xl p-16 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center text-emerald-600">
                <Brain className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Deploy Conversational Intelligence</h3>
                <p className="text-xs mt-1 max-w-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Select one of your deployed agents from the left menu or click "+ Blueprint" to launch a new, high-converting smart assistant.
                </p>
              </div>
            </div>
          ) : (
            <div className="glass rounded-3xl p-6 space-y-6 animate-slide-up">
              
              {/* Deployed Header Info */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-black/[0.04]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-sm font-bold text-slate-900">{selected.name}</h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase">
                      {selected.provider} · {selected.model}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{selected.description || 'Automating conversations'}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggle(selected)}
                    className="text-xs px-3 py-1.5 rounded-xl font-bold transition-all border"
                    style={{
                      background: selected.active ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.08)',
                      borderColor: selected.active ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                      color: selected.active ? '#dc2626' : '#15803d',
                    }}>
                    {selected.active ? 'Disable Agent' : 'Enable Agent'}
                  </button>
                  
                  <button onClick={() => openEdit(selected)}
                    className="text-xs px-3 py-1.5 rounded-xl font-bold bg-black/5 hover:bg-black/10 border border-black/10 text-slate-700 flex items-center gap-1.5 transition-all">
                    <Edit2 className="w-3.5 h-3.5" /> Modify
                  </button>
                  
                  <button onClick={() => handleDelete(selected)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-50 hover:bg-red-100 transition-colors border border-red-100"
                    title="Delete Deployed Agent">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>

              {/* Collapsible System Prompt Panel */}
              <div className="p-4 rounded-2xl bg-black/[0.015] border border-black/[0.04]">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Deployed Prompt Directives</div>
                <pre className="text-xs leading-relaxed text-slate-600 whitespace-pre-wrap font-sans">
                  {selected.system_prompt}
                </pre>
              </div>

              {/* INTERACTIVE MOCK WHATSAPP SANDBOX & EXTRACTION ANALYTICS */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">Live Simulation Sandbox Room</h3>
                    <p className="text-[10px] text-slate-400">Interact in real-time with your agent exactly like a customer on WhatsApp.</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                    <Smartphone className="w-3 h-3" />
                    <span>Instant Testing</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  
                  {/* WhatsApp Device Mock */}
                  <div className="md:col-span-3 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl bg-slate-900 flex flex-col h-[480px]">
                    
                    {/* Device Header */}
                    <div className="bg-[#075e54] px-4 py-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-full bg-slate-100/10 flex items-center justify-center border border-emerald-400/30">
                            <Brain className="w-4.5 h-4.5 text-emerald-300" />
                          </div>
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#075e54]" />
                        </div>
                        <div>
                          <div className="text-white text-xs font-bold leading-tight truncate max-w-[130px]">
                            {selected.name}
                          </div>
                          <div className="text-[10px] text-emerald-200 flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-emerald-300 animate-pulse" />
                            AI Assistant Online
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-emerald-200">
                        <Smartphone className="w-4 h-4 opacity-70" />
                        <button 
                          onClick={() => initChat(selected)} 
                          title="Clear & Restart chat"
                          className="p-1 hover:bg-emerald-800 rounded-lg transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* WhatsApp Conversation List */}
                    <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#e5ddd5]" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'contain' }}>
                      {chatHistory.map((m, idx) => (
                        <div 
                          key={idx} 
                          className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div 
                            className={`max-w-[82%] rounded-xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                              m.role === 'user' 
                                ? 'bg-[#dcf8c6] text-zinc-900 rounded-tr-none' 
                                : 'bg-white text-zinc-900 rounded-tl-none'
                            }`}
                          >
                            <p className="whitespace-pre-wrap text-[11.5px]">{m.content}</p>
                            <span className="block text-[8.5px] mt-1 text-right text-zinc-400">
                              {idx === 0 ? 'Greet' : 'Just now'}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Animated Typing State */}
                      {typingMsg && (
                        <div className="flex justify-start">
                          <div className="bg-white text-zinc-500 rounded-xl rounded-tl-none px-3 py-2 text-xs flex items-center gap-1.5 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                            <span className="text-[10px] ml-1 text-zinc-400 italic">Agent is typing...</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Chat Form Input Bar */}
                    <form onSubmit={sendSimulatedMessage} className="bg-[#f0f0f0] p-2.5 border-t border-zinc-200 flex items-center gap-2">
                      <input 
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        disabled={typingMsg}
                        placeholder="Type standard customer text..."
                        className="flex-1 bg-white border border-zinc-200 focus:border-emerald-600 outline-none rounded-full px-4 py-1.5 text-xs text-zinc-800"
                      />
                      <button 
                        type="submit"
                        disabled={!chatInput.trim() || typingMsg}
                        className="p-2.5 rounded-full bg-[#075e54] hover:bg-[#054c43] text-white disabled:opacity-40 transition-all flex-shrink-0 shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>

                  </div>

                  {/* Dynamic extracted insights metrics sidebar */}
                  <div className="md:col-span-2 flex flex-col justify-between gap-4">
                    
                    <div className="glass p-4 rounded-3xl bg-black/[0.01] border border-black/[0.04] space-y-3">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold text-slate-800">Dynamic Extracted Values</span>
                      </div>

                      <div className="space-y-2">
                        {/* Occasion */}
                        <div className="p-2 rounded-xl bg-black/5 flex flex-col gap-0.5 border border-black/[0.01]">
                          <span className="text-[9px] text-slate-400 uppercase font-semibold">Occasion type</span>
                          <span className={`text-[11px] font-bold ${occasion !== 'Not detected yet' ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {occasion}
                          </span>
                        </div>

                        {/* Budget */}
                        <div className="p-2 rounded-xl bg-black/5 flex flex-col gap-0.5 border border-black/[0.01]">
                          <span className="text-[9px] text-slate-400 uppercase font-semibold">Stated budget</span>
                          <span className={`text-[11px] font-bold ${budget !== 'Not detected yet' ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {budget}
                          </span>
                        </div>

                        {/* Timeline */}
                        <div className="p-2 rounded-xl bg-black/5 flex flex-col gap-0.5 border border-black/[0.01]">
                          <span className="text-[9px] text-slate-400 uppercase font-semibold">Event date urgency</span>
                          <span className={`text-[11px] font-bold ${date !== 'Not detected yet' ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {date}
                          </span>
                        </div>

                        {/* Classification */}
                        <div className="p-2 rounded-xl bg-black/5 flex flex-col gap-0.5 border border-black/[0.01]">
                          <span className="text-[9px] text-slate-400 uppercase font-semibold">Overall Lead Intent</span>
                          <span className={`text-[11px] font-bold ${score >= 70 ? 'text-rose-600' : score >= 45 ? 'text-amber-600' : 'text-slate-500'}`}>
                            {intent}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Scoring Gauge card */}
                    <div className="glass p-4 rounded-3xl bg-emerald-500/[0.03] border border-emerald-500/10 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">Dynamic Score Metric</span>
                        <span className="font-mono text-emerald-600 font-bold">{score}/100</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-500 ease-out" 
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      
                      {/* Latency feedback */}
                      {testResult && (
                        <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 border-t border-black/[0.03] pt-2">
                          <span>LLM Latency: {testResult.latency}ms</span>
                          <span>Tokens: {testResult.tokens}</span>
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              </div>

            </div>
          )
        )}

        {/* CREATE NEW OR EDITING FORM */}
        {(mode === 'new' || mode === 'edit') && (
          <div className="glass rounded-3xl p-6 space-y-5 animate-slide-up">
            
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.04]">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {mode === 'new' ? 'Create Automated Agent Blueprint' : `Modify Deployed Agent Rules`}
                </h2>
                <p className="text-xs text-slate-500">Configure how the AI behaves during customer conversations</p>
              </div>
              
              <button onClick={() => { setMode('view') }}
                className="text-xs px-3.5 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 text-slate-600 font-bold transition-all">
                Cancel
              </button>
            </div>

            {/* BLUEPRINTS PRESET LIST CARDS - VISUAL AUTOMATION FOR NON-TECHNICAL USERS */}
            {mode === 'new' && (
              <div className="space-y-2.5">
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">
                  Select a Google-Style Prompt Blueprint (Instantly Populate)
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {SYSTEM_PRESETS.map((preset) => (
                    <button 
                      key={preset.name}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="text-left p-3 rounded-2xl border border-black/10 hover:border-emerald-500/40 bg-black/[0.01] hover:bg-emerald-500/[0.02] transition-all group duration-200"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-800">{preset.name}</span>
                        <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                          {preset.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-normal">{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* FORM INPUTS */}
            <div className="space-y-4 pt-2">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold block mb-1 text-slate-700">Agent Name *</label>
                  <input 
                    value={form.name} 
                    onChange={e => set('name', e.target.value)} 
                    placeholder="e.g. Bridal Saree Qualifier"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-emerald-500 transition-all text-slate-800" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1 text-slate-700">Description</label>
                  <input 
                    value={form.description} 
                    onChange={e => set('description', e.target.value)} 
                    placeholder="Brief description of when this agent triggers"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-emerald-500 transition-all text-slate-800" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold block mb-1 text-slate-700">Provider</label>
                  <select 
                    value={form.provider} 
                    onChange={e => { set('provider', e.target.value); set('model', MODELS[e.target.value][0]) }}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-emerald-500 transition-all text-slate-800 font-mono"
                  >
                    {PROVIDERS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1 text-slate-700">Model</label>
                  <select 
                    value={form.model} 
                    onChange={e => set('model', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-emerald-500 transition-all text-slate-800 font-mono"
                  >
                    {(MODELS[form.provider] ?? []).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold block mb-1 text-slate-700 font-sans">Temperature (0.0 – 1.0)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="1" 
                    step="0.1" 
                    value={form.temperature} 
                    onChange={e => set('temperature', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-emerald-500 transition-all text-slate-800 font-mono" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1 text-slate-700 font-sans">Max Tokens Output Limit</label>
                  <input 
                    type="number" 
                    value={form.max_tokens} 
                    onChange={e => set('max_tokens', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-black/5 border border-black/10 focus:border-emerald-500 transition-all text-slate-800 font-mono" 
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1 text-slate-700">System Instruction Prompt (Rules / Behavior Directive) *</label>
                <textarea 
                  value={form.system_prompt} 
                  onChange={e => set('system_prompt', e.target.value)} 
                  rows={8}
                  placeholder="Tell the agent who they are, how to qualify the lead, and what question sequence to follow..."
                  className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-none bg-black/5 border border-black/10 focus:border-emerald-500 transition-all text-slate-800 leading-relaxed font-mono" 
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer py-1 select-none">
                <input 
                  type="checkbox" 
                  checked={form.active} 
                  onChange={e => set('active', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600" 
                />
                <span className="text-xs font-medium text-slate-600">
                  Deploy immediately as Active (Available to trigger inside automation sequences)
                </span>
              </label>
            </div>

            {/* CONFIRM / DEPLOY AGENT ACTION */}
            <div className="pt-3 border-t border-black/[0.04] flex items-center justify-between">
              <span className="text-[10px] text-slate-400 italic">
                * Deploying writes standard environmental schemas to Supabase
              </span>

              <button 
                onClick={handleSave} 
                disabled={createAgent.isPending || updateAgent.isPending}
                className="px-6 py-2.5 rounded-xl text-xs text-white font-bold flex items-center gap-2 transition-all hover:scale-[1.01] shadow-md"
                style={{ background: 'linear-gradient(135deg,#166534,#22c55e)' }}
              >
                {(createAgent.isPending || updateAgent.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {mode === 'new' ? 'Deploy Smart Agent' : 'Commit Changes'}
              </button>
            </div>

          </div>
        )}

      </div>

    </div>
  )
}
