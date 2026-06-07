export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      contacts:            { Row: Contact;           Insert: Omit<Contact,           'id'|'created_at'|'updated_at'>;  Update: Partial<Omit<Contact,           'id'>> }
      leads:               { Row: Lead;              Insert: Omit<Lead,              'id'|'created_at'|'updated_at'>;  Update: Partial<Omit<Lead,              'id'>> }
      conversations:       { Row: Conversation;      Insert: Omit<Conversation,      'id'|'created_at'|'updated_at'>;  Update: Partial<Omit<Conversation,      'id'>> }
      messages:            { Row: Message;           Insert: Omit<Message,           'id'|'created_at'>;               Update: Partial<Omit<Message,           'id'>> }
      tasks:               { Row: Task;              Insert: Omit<Task,              'id'|'created_at'|'updated_at'>;  Update: Partial<Omit<Task,              'id'>> }
      ai_requests:         { Row: AIRequest;         Insert: Omit<AIRequest,         'id'|'created_at'>;               Update: Partial<Omit<AIRequest,         'id'>> }
      agents:              { Row: Agent;             Insert: Omit<Agent,             'id'|'created_at'|'updated_at'>;  Update: Partial<Omit<Agent,             'id'>> }
      workflows:           { Row: Workflow;          Insert: Omit<Workflow,          'id'|'created_at'|'updated_at'>;  Update: Partial<Omit<Workflow,          'id'>> }
      workflow_runs:       { Row: WorkflowRun;       Insert: Omit<WorkflowRun,       'id'|'started_at'>;               Update: Partial<Omit<WorkflowRun,       'id'>> }
      appointments:        { Row: Appointment;       Insert: Omit<Appointment,       'id'|'created_at'|'updated_at'>;  Update: Partial<Omit<Appointment,       'id'>> }
      knowledge_documents: { Row: KnowledgeDocument; Insert: Omit<KnowledgeDocument, 'id'|'created_at'>;               Update: Partial<Omit<KnowledgeDocument, 'id'>> }
      team_members:        { Row: TeamMember;        Insert: Omit<TeamMember,        'id'|'created_at'>;               Update: Partial<Omit<TeamMember,        'id'>> }
      organizations:       { Row: Organization;      Insert: Omit<Organization,      'id'|'created_at'|'updated_at'>;  Update: Partial<Omit<Organization,      'id'>> }
      notifications:       { Row: Notification;      Insert: Omit<Notification,      'id'|'created_at'>;               Update: Partial<Omit<Notification,      'id'>> }
      campaigns:           { Row: Campaign;          Insert: Omit<Campaign,          'id'|'created_at'|'updated_at'>;  Update: Partial<Omit<Campaign,          'id'>> }
      campaign_leads:      { Row: CampaignLead;      Insert: Omit<CampaignLead,      'id'|'created_at'>;               Update: Partial<Omit<CampaignLead,      'id'>> }
      billing_events:      { Row: BillingEvent;      Insert: Omit<BillingEvent,      'id'|'created_at'>;               Update: Partial<Omit<BillingEvent,      'id'>> }
      message_retry_queue: { Row: MessageRetryJob;   Insert: Omit<MessageRetryJob,   'id'|'created_at'>;               Update: Partial<Omit<MessageRetryJob,   'id'>> }
      ai_logs:             { Row: AILog;             Insert: Omit<AILog,             'id'|'created_at'>;               Update: Partial<Omit<AILog,             'id'>> }
      products:            { Row: Product;           Insert: Omit<Product,           'id'|'created_at'>;               Update: Partial<Omit<Product,           'id'>> }
    }
  }
}

export interface Contact {
  id: string
  phone: string
  name: string | null
  email: string | null
  avatar_url: string | null
  tags: string[]
  custom_fields: Json
  opted_in: boolean
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  contact_id: string | null
  name: string
  phone: string
  email: string | null
  stage: 'new' | 'qualified' | 'contacted' | 'scheduled' | 'negotiation' | 'converted' | 'closed'
  ai_score: number
  budget: number | null
  intent: string | null
  urgency: 'low' | 'medium' | 'high'
  confidence: number
  sentiment: 'positive' | 'neutral' | 'negative'
  notes: string | null
  assigned_to: string | null
  tags: string[]
  ai_summary: string | null
  source: string
  lost_reason: string | null
  converted_at: string | null
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  contact_id: string | null
  lead_id: string | null
  wa_conversation_id: string | null
  status: 'open' | 'waiting' | 'resolved' | 'archived'
  channel: string
  assigned_to: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  last_message_at: string
  last_message_preview: string | null
  unread_count: number
  ai_score: number
  sentiment: string
  tags: string[]
  sla_breached: boolean
  ai_summary: string | null
  ai_auto_reply: boolean        // FIX: was missing from types
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  wa_message_id: string | null
  direction: 'inbound' | 'outbound'
  sender_type: 'customer' | 'agent' | 'ai' | 'system'
  sender_name: string | null
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'template' | 'interactive' | 'note'
  content: string | null
  media_url: string | null
  media_mime_type: string | null
  media_filename: string | null
  template_name: string | null
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  wa_timestamp: string | null
  metadata: Json
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  lead_id: string | null
  conversation_id: string | null
  assigned_to: string | null
  status: 'pending' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string | null
  ai_generated: boolean
  ai_reasoning: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface AIRequest {
  id: string
  provider: string
  model: string
  task_type: string
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  latency_ms: number | null
  cost_usd: number | null
  success: boolean
  error_message: string | null
  conversation_id: string | null
  lead_id: string | null
  input_hash: string | null
  created_at: string
}

export interface Agent {
  id: string
  name: string
  description: string | null
  provider: string
  model: string
  system_prompt: string
  temperature: number
  max_tokens: number
  tools: Json
  active: boolean
  trigger_conditions: Json
  created_at: string
  updated_at: string
}

export interface Workflow {
  id: string
  name: string
  description: string | null
  trigger_type: 'inbound_message' | 'lead_score' | 'inactivity' | 'stage_change' | 'appointment' | 'manual' | 'scheduled'
  trigger_config: Json
  steps: Json
  active: boolean
  run_count: number
  success_count: number
  last_run_at: string | null
  created_at: string
  updated_at: string
}

export interface WorkflowRun {
  id: string
  workflow_id: string | null
  trigger_data: Json
  status: 'running' | 'success' | 'failed' | 'cancelled'
  steps_completed: number
  error_message: string | null
  started_at: string
  completed_at: string | null
}

export interface Appointment {
  id: string
  lead_id: string | null
  contact_id: string | null
  title: string
  notes: string | null
  scheduled_at: string
  duration_minutes: number
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  reminder_sent: boolean
  reminder_24h_sent: boolean   // FIX: was missing
  reminder_2h_sent: boolean    // FIX: was missing
  confirmation_requested: boolean // FIX: was missing
  created_at: string
  updated_at: string
}

export interface KnowledgeDocument {
  id: string
  title: string
  content: string
  source: string | null
  tags: string[]
  active: boolean
  created_at: string
}

export interface TeamMember {
  id: string
  auth_user_id: string | null
  name: string
  email: string
  role: 'owner' | 'admin' | 'manager' | 'agent' | 'support'
  avatar_url: string | null
  phone: string | null
  whatsapp_notifications: boolean
  active: boolean
  status: 'online' | 'away' | 'offline'
  open_conversation_count: number
  created_at: string
}

export interface Organization {
  id: string
  name: string
  plan: 'starter' | 'growth' | 'pro' | 'enterprise'
  billing_period_start: string
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  type: string
  title: string
  body: string
  recipient: string | null
  lead_id: string | null
  conversation_id: string | null
  read: boolean
  channels: string[]
  metadata: Json
  created_at: string
}

export interface Campaign {
  id: string
  name: string
  description: string | null
  status: 'draft' | 'active' | 'paused' | 'completed'
  open_rate: number
  reply_rate: number
  conversion_rate: number
  metrics: Json
  ai_optimisation_suggestion: string | null
  created_at: string
  updated_at: string
}

export interface CampaignLead {
  id: string
  campaign_id: string
  lead_id: string
  status: 'pending' | 'sent' | 'delivered' | 'replied' | 'converted'
  sent_at: string | null
  replied_at: string | null
  converted_at: string | null
  created_at: string
}

export interface MessageRetryJob {
  id: string
  conversation_id: string | null
  contact_phone: string
  message_type: 'text' | 'template'
  content: string
  template_name: string | null
  template_variables: string[]
  error_code: string
  error_message: string
  attempt_count: number
  max_attempts: number
  next_attempt_at: string
  status: 'pending' | 'retrying' | 'succeeded' | 'failed' | 'escalated'
  created_at: string
  updated_at: string
}

export interface AILog {
  id: string
  provider: string | null
  model: string | null
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost_usd: number
  latency_ms: number | null
  task_type: string | null
  conversation_id: string | null
  lead_id: string | null
  created_at: string
}

export interface Product {
  id: string
  name: string
  description: string | null
  price_monthly: number | null
  price_yearly: number | null
  features: Json
  stripe_product_id: string | null
  stripe_price_id_monthly: string | null
  stripe_price_id_yearly: string | null
  active: boolean
  created_at: string
}

export interface BillingEvent {
  id: string
  org_id: string | null
  event_type: string
  plan_id: string | null
  amount: number | null
  stripe_session_id: string | null
  metadata: Json
  created_at: string
}

// Enriched types (joins)
export interface ConversationWithContact extends Conversation {
  contact: Contact | null
  lead: Lead | null
}

export interface LeadWithContact extends Lead {
  contact: Contact | null
}

export interface MessageWithSender extends Message {
  sender?: TeamMember | null
}
