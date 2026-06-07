import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || ''

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Browser-safe client
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)

export type Database = {
  public: {
    Tables: {
      conversations: {
        Row: {
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
      }

      messages: {
        Row: {
          id: string
          conversation_id: string
          sender: 'customer' | 'agent' | 'ai'
          content: string
          message_type:
            | 'text'
            | 'image'
            | 'document'
            | 'note'
          whatsapp_message_id: string | null
          read: boolean
          created_at: string
        }
      }

      leads: {
        Row: {
          id: string
          name: string
          phone: string
          email: string
          stage:
            | 'new'
            | 'qualified'
            | 'contacted'
            | 'scheduled'
            | 'negotiation'
            | 'converted'

          score: number
          budget: number
          intent: string

          urgency:
            | 'low'
            | 'medium'
            | 'high'

          confidence: number
          last_contact: string
          tags: string[]
          notes: string
          created_at: string
          updated_at: string
        }
      }

      tasks: {
        Row: {
          id: string
          title: string
          lead_id: string | null
          due_date: string

          priority:
            | 'low'
            | 'medium'
            | 'high'
            | 'urgent'

          status:
            | 'pending'
            | 'in_progress'
            | 'done'

          ai_generated: boolean
          created_at: string
          updated_at: string
        }
      }
    }
  }
}