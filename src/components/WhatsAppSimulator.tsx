'use client'
import { useState, useEffect, useRef } from 'react'
import { useConversations, useMessages } from '@/lib/hooks'
import {
  Send, Smartphone, X, MessageSquare, Sparkles, CheckCheck,
  User, ChevronLeft, Info, HelpCircle, ShieldAlert, BadgeHelp, Loader2
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Preset Customers & Messages ───────────────────────────────
const PRESET_CUSTOMERS = [
  {
    id: 'bridal',
    name: 'Priya Sharma',
    phone: '919999988888',
    avatar: '🌸',
    label: 'Bridal Saree Inquiry',
    presetMessage: 'Hi! I am looking for a traditional red Banarasi silk saree for my wedding on 15th December. My budget is around INR 1.5 Lakhs. Do you have appointments open?',
  },
  {
    id: 'showroom',
    name: 'Rohan Mehta',
    phone: '918888877777',
    avatar: '📅',
    label: 'Showroom Booking',
    presetMessage: 'Hello, I would love to book a luxury showroom consultation at your Delhi store for this coming Saturday at 3 PM. Can you confirm?',
  },
  {
    id: 'faq',
    name: 'Sneha Gupta',
    phone: '917777766666',
    avatar: '🙋',
    label: 'Policy & Shipping FAQ',
    presetMessage: 'Do you offer free insured international shipping to New York? Also, what is your standard delivery timeline for custom couture?',
  },
  {
    id: 'vip',
    name: 'Amit Verma (Bulk)',
    phone: '916666655555',
    avatar: '🔥',
    label: 'VIP Bulk Order',
    presetMessage: 'Hello, I am a boutique reseller and want to order 25 bridal sarees and custom couture. Can I speak to creative director Ajo directly?',
  },
]

export default function WhatsAppSimulator() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCust, setSelectedCust] = useState(PRESET_CUSTOMERS[0])
  const [customPhone, setCustomPhone] = useState('')
  const [customName, setCustomName] = useState('')
  const [isCustomMode, setIsCustomMode] = useState(false)
  
  const [messageText, setMessageText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Fetch active conversations
  const { data: conversations, refetch: refetchConvs } = useConversations('all')
  
  // Find conversation matching the current active phone
  const activePhone = isCustomMode ? customPhone.replace(/\D/g, '') : selectedCust.phone
  const activeName = isCustomMode ? customName || 'Guest User' : selectedCust.name
  
  const currentConversation = (conversations ?? []).find(
    (c: any) => c.contact?.phone === activePhone
  )
  const conversationId = currentConversation?.id ?? null

  // Fetch message thread
  const { data: messages, refetch: refetchMsgs } = useMessages(conversationId)

  // Scroll to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  // Automatically load the preset message when switching customers
  useEffect(() => {
    if (!isCustomMode) {
      setMessageText(selectedCust.presetMessage)
    } else {
      setMessageText('')
    }
  }, [selectedCust, isCustomMode])

  // Send Mock Webhook POST
  async function handleSend(overrideText?: string) {
    const textToSend = (overrideText ?? messageText).trim()
    if (!textToSend) return toast.error('Please enter a message or select a preset')
    if (isCustomMode && (!customPhone || !customName)) {
      return toast.error('Please enter phone number and name for custom simulation')
    }

    setIsSending(true)
    const mockMsgId = `wa-msg-sim-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`

    // Format identical to Meta's WhatsApp Webhook Body
    const webhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'mock_entry_id',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '919999900000',
                  phone_number_id: 'mock_phone_id'
                },
                contacts: [
                  {
                    profile: { name: activeName },
                    wa_id: activePhone
                  }
                ],
                messages: [
                  {
                    id: mockMsgId,
                    from: activePhone,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: 'text',
                    text: { body: textToSend }
                  }
                ]
              }
            }
          ]
        }
      ]
    }

    try {
      const res = await fetch('/api/webhooks/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      })

      if (!res.ok) {
        throw new Error('Simulation failed')
      }

      // Clear input
      setMessageText('')
      toast.success('Simulation webhook sent successfully!')
      
      // Force immediate cache refetch
      setTimeout(() => {
        refetchConvs()
        if (conversationId) refetchMsgs()
      }, 1000)

    } catch (err: any) {
      toast.error('Simulation payload delivery failed')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        id="whatsapp-sim-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3.5 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 duration-200 text-white font-medium"
        style={{
          background: 'linear-gradient(135deg, #25D366, #128C7E)',
          boxShadow: '0 8px 30px rgba(37, 211, 102, 0.4)'
        }}
      >
        <Smartphone className="w-5 h-5 animate-pulse" />
        <span className="text-xs tracking-wide">WhatsApp Sandbox</span>
        {/* Dynamic Indicator */}
        <span className="w-2.5 h-2.5 bg-green-300 rounded-full animate-ping absolute top-1 right-1" />
      </button>

      {/* Side Slide-Out Phone Frame */}
      {isOpen && (
        <div
          id="whatsapp-sim-drawer"
          className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] shadow-3xl flex flex-col border-l transition-all animate-slide-in-right"
          style={{
            background: '#ece5dd',
            borderColor: 'rgba(0,0,0,0.08)',
            boxShadow: '-10px 0 40px rgba(0,0,0,0.12)'
          }}
        >
          {/* Header Controls / Selector */}
          <div className="bg-[#075e54] text-white p-4 pb-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-green-300" />
                <span className="text-xs font-bold uppercase tracking-wider text-green-200">WhatsApp Sandbox Phone</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:bg-black/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/80 hover:text-white" />
              </button>
            </div>

            {/* Quick Presets Select Grid */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-green-200 uppercase">Select Simulator Customer</span>
                <button
                  onClick={() => setIsCustomMode(!isCustomMode)}
                  className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-full transition-all text-white font-semibold"
                >
                  {isCustomMode ? 'Use Presets' : 'Custom Number'}
                </button>
              </div>

              {isCustomMode ? (
                <div className="grid grid-cols-2 gap-1.5 animate-fade-in">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Customer Name (e.g., Jane)"
                    className="w-full bg-white/10 text-white text-[11px] px-2 py-1 rounded outline-none placeholder-white/50 border border-white/15"
                  />
                  <input
                    type="text"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    placeholder="Phone (e.g., 9198765432)"
                    className="w-full bg-white/10 text-white text-[11px] px-2 py-1 rounded outline-none placeholder-white/50 border border-white/15"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1">
                  {PRESET_CUSTOMERS.map((cust) => {
                    const isSel = selectedCust.id === cust.id;
                    return (
                      <button
                        key={cust.id}
                        onClick={() => { setSelectedCust(cust); setIsCustomMode(false); }}
                        className="flex flex-col items-center justify-center p-1 rounded-lg transition-all text-center"
                        style={{
                          background: isSel ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
                          border: isSel ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent'
                        }}
                      >
                        <span className="text-sm">{cust.avatar}</span>
                        <span className="text-[9px] font-semibold truncate w-full mt-0.5 text-white/90">
                          {cust.name.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* WhatsApp Header Mock */}
          <div className="bg-[#128c7e] text-white py-2.5 px-3 flex items-center gap-2.5 shadow flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {isCustomMode ? '👤' : selectedCust.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate">
                {isCustomMode ? (customName || 'Custom Guest') : selectedCust.name}
              </div>
              <div className="text-[9px] text-white/85 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                +{activePhone}
              </div>
            </div>
            <div className="text-[10px] bg-black/15 text-green-200 px-2 py-1 rounded-full font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-green-300" /> AI Auto-Reply Active
            </div>
          </div>

          {/* Sandbox Info Banner */}
          <div className="bg-[#dcfce7] border-b border-green-200 text-[#166534] text-[10px] px-3 py-1.5 flex items-center gap-1.5 font-medium flex-shrink-0">
            <Info className="w-3.5 h-3.5 flex-shrink-0 text-green-600" />
            <span>Sends simulated WhatsApp webhooks to test Agents & CRM rules.</span>
          </div>

          {/* Chat Bubble Container */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-2 relative"
            style={{
              backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
              backgroundSize: 'contain',
              backgroundBlendMode: 'overlay',
              backgroundColor: '#efeae2'
            }}
          >
            {messages && messages.length > 0 ? (
              messages.map((m: any) => {
                const isCustomer = m.direction === 'inbound';
                return (
                  <div
                    key={m.id}
                    className={`flex ${isCustomer ? 'justify-end' : 'justify-start'} mb-1.5`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs shadow-sm relative ${
                        isCustomer
                          ? 'bg-[#dcf8c6] text-gray-800 rounded-tr-none'
                          : 'bg-white text-gray-800 rounded-tl-none'
                      }`}
                    >
                      {/* Sender tag if AI or agent */}
                      {!isCustomer && (
                        <div className="text-[9px] font-bold text-purple-600 mb-0.5 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-purple-500" />
                          {m.sender_name ?? 'StrixMind AI'}
                        </div>
                      )}
                      
                      <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                      
                      <div className="text-[8px] text-gray-400 text-right mt-1 flex items-center justify-end gap-1 select-none">
                        {new Date(m.created_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                        {isCustomer ? (
                          <CheckCheck className="w-3 h-3 text-blue-500" />
                        ) : (
                          <CheckCheck className="w-3 h-3 text-green-500" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 select-none bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-100 max-w-sm mx-auto my-auto mt-12">
                <BadgeHelp className="w-8 h-8 text-emerald-600 mb-2" />
                <h4 className="text-xs font-bold text-gray-700">No active sandbox conversation</h4>
                <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                  Press send or choose a preset query to simulate a customer messaging the boutique. See the AI agents orchestrate, reply, and update the CRM board in real-time!
                </p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Typing/Sending state indicators */}
          {isSending && (
            <div className="bg-[#efeae2]/90 backdrop-blur-sm px-4 py-1.5 text-[10px] text-emerald-700 font-semibold flex items-center gap-1.5 flex-shrink-0">
              <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
              <span>Delivering payload to webhook...</span>
            </div>
          )}

          {/* Preset templates list (above input box) */}
          {!isCustomMode && selectedCust.presetMessage && (
            <div className="bg-white/95 border-t border-gray-100 p-2 flex flex-col gap-1 flex-shrink-0">
              <div className="text-[8px] uppercase tracking-wider font-bold text-gray-400">Preset Query</div>
              <button
                onClick={() => handleSend(selectedCust.presetMessage)}
                disabled={isSending}
                className="text-[10px] text-left p-1.5 rounded bg-emerald-50 hover:bg-emerald-100/60 border border-emerald-100 text-emerald-800 transition-all font-medium"
              >
                {selectedCust.presetMessage}
              </button>
            </div>
          )}

          {/* WhatsApp Chat Input Box */}
          <div className="bg-[#f0f0f0] p-2 flex items-center gap-1.5 border-t border-gray-200 flex-shrink-0">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type customer reply..."
              disabled={isSending}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend()
              }}
              className="flex-1 bg-white border border-gray-300 rounded-full py-1.5 px-3 text-xs outline-none focus:border-emerald-500 text-gray-800"
            />
            <button
              onClick={() => handleSend()}
              disabled={isSending || !messageText.trim()}
              className="w-8 h-8 rounded-full bg-[#128c7e] hover:bg-[#075e54] flex items-center justify-center text-white transition-all disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
