import { createSupabaseServiceClientUntyped } from './supabase/server'

// Lazy service client — only instantiated when called (server-side only)
function db() { return createSupabaseServiceClientUntyped() }

export interface Conversation {
  id: string
  customer_phone: string
  customer_name: string
  last_message: string
  last_message_time: string
  status: 'open' | 'waiting' | 'resolved'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigned_to: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender: 'customer' | 'agent' | 'ai'
  content: string
  message_type: 'text' | 'image' | 'document' | 'note'
  whatsapp_message_id: string | null
  read: boolean
  created_at: string
}

// Get all conversations
export async function getConversations(): Promise<Conversation[]> {
  const { data, error } = await db()
    .from('conversations')
    .select('*')
    .order('last_message_time', { ascending: false })

  if (error) {
    console.error('Error fetching conversations:', error)
    return []
  }

  return data as Conversation[]
}

// Get conversation by ID with messages
export async function getConversationWithMessages(
  conversationId: string
): Promise<{ conversation: Conversation; messages: Message[] } | null> {
  const { data: conversation, error: convError } = await db()
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single()

  if (convError) {
    console.error('Error fetching conversation:', convError)
    return null
  }

  const { data: messages, error: msgError } = await db()
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (msgError) {
    console.error('Error fetching messages:', msgError)
    return null
  }

  return {
    conversation: conversation as Conversation,
    messages: messages as Message[],
  }
}

// Create or update conversation
export async function upsertConversation(
  phoneNumber: string,
  data: Partial<Conversation>
): Promise<Conversation | null> {
  const { data: conversation, error } = await db()
    .from('conversations')
    .upsert(
      {
        customer_phone: phoneNumber,
        ...data,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'customer_phone',
      }
    )
    .select()
    .single()

  if (error) {
    console.error('Error upserting conversation:', error)
    return null
  }

  return conversation as Conversation
}

// Add message to conversation
export async function addMessage(
  conversationId: string,
  message: Partial<Message>
): Promise<Message | null> {
  const { data, error } = await db()
    .from('messages')
    .insert({
      conversation_id: conversationId,
      ...message,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding message:', error)
    return null
  }

  return data as Message
}

// Mark conversation messages as read
export async function markConversationAsRead(
  conversationId: string
): Promise<boolean> {
  const { error } = await db()
    .from('messages')
    .update({ read: true })
    .eq('conversation_id', conversationId)
    .eq('sender', 'customer')
    .eq('read', false)

  if (error) {
    console.error('Error marking messages as read:', error)
    return false
  }

  return true
}

// Update conversation status
export async function updateConversationStatus(
  conversationId: string,
  status: string
): Promise<boolean> {
  const { error } = await db()
    .from('conversations')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)

  if (error) {
    console.error('Error updating conversation status:', error)
    return false
  }

  return true
}
