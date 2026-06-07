-- ============================================================
-- StrixMind Complete Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── CONTACTS ────────────────────────────────────────────────
create table if not exists contacts (
  id uuid primary key default uuid_generate_v4(),
  phone text unique not null,
  name text,
  email text,
  avatar_url text,
  tags text[] default '{}',
  custom_fields jsonb default '{}',
  opted_in boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── LEADS ───────────────────────────────────────────────────
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid references contacts(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  stage text not null default 'new' check (stage in ('new','qualified','contacted','scheduled','negotiation','converted','closed')),
  ai_score integer default 0 check (ai_score >= 0 and ai_score <= 100),
  budget numeric(12,2),
  intent text,
  urgency text default 'low' check (urgency in ('low','medium','high')),
  confidence numeric(4,3) default 0,
  sentiment text default 'neutral' check (sentiment in ('positive','neutral','negative')),
  notes text,
  assigned_to uuid,
  tags text[] default '{}',
  ai_summary text,
  source text default 'whatsapp',
  lost_reason text,
  converted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── CONVERSATIONS ───────────────────────────────────────────
create table if not exists conversations (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid references contacts(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  wa_conversation_id text,
  status text default 'open' check (status in ('open','waiting','resolved','archived')),
  channel text default 'whatsapp',
  assigned_to uuid,
  priority text default 'medium' check (priority in ('low','medium','high','urgent')),
  last_message_at timestamptz default now(),
  last_message_preview text,
  unread_count integer default 0,
  ai_score integer default 0,
  sentiment text default 'neutral',
  tags text[] default '{}',
  sla_breached boolean default false,
  ai_summary text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── MESSAGES ────────────────────────────────────────────────
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  wa_message_id text unique,
  direction text not null check (direction in ('inbound','outbound')),
  sender_type text not null check (sender_type in ('customer','agent','ai','system')),
  sender_name text,
  type text default 'text' check (type in ('text','image','audio','video','document','location','template','interactive','note')),
  content text,
  media_url text,
  media_mime_type text,
  media_filename text,
  template_name text,
  status text default 'sent' check (status in ('pending','sent','delivered','read','failed')),
  wa_timestamp timestamptz,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- ─── TASKS ───────────────────────────────────────────────────
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  lead_id uuid references leads(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  assigned_to uuid,
  status text default 'pending' check (status in ('pending','in_progress','done','cancelled')),
  priority text default 'medium' check (priority in ('low','medium','high','urgent')),
  due_date timestamptz,
  ai_generated boolean default false,
  ai_reasoning text,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── AI REQUESTS (observability) ─────────────────────────────
create table if not exists ai_requests (
  id uuid primary key default uuid_generate_v4(),
  provider text not null,
  model text not null,
  task_type text not null,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  latency_ms integer,
  cost_usd numeric(10,6),
  success boolean default true,
  error_message text,
  conversation_id uuid references conversations(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  input_hash text,
  created_at timestamptz default now()
);

-- ─── AGENTS (AI agent configurations) ────────────────────────
create table if not exists agents (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  provider text not null default 'openai',
  model text not null default 'gpt-4o',
  system_prompt text not null,
  temperature numeric(3,2) default 0.7,
  max_tokens integer default 1000,
  tools jsonb default '[]',
  active boolean default true,
  trigger_conditions jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── WORKFLOWS ───────────────────────────────────────────────
create table if not exists workflows (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  trigger_type text not null check (trigger_type in ('inbound_message','lead_score','inactivity','stage_change','appointment','manual','scheduled')),
  trigger_config jsonb default '{}',
  steps jsonb not null default '[]',
  active boolean default true,
  run_count integer default 0,
  success_count integer default 0,
  last_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── WORKFLOW RUNS ────────────────────────────────────────────
create table if not exists workflow_runs (
  id uuid primary key default uuid_generate_v4(),
  workflow_id uuid references workflows(id) on delete cascade,
  trigger_data jsonb default '{}',
  status text default 'running' check (status in ('running','success','failed','cancelled')),
  steps_completed integer default 0,
  error_message text,
  started_at timestamptz default now(),
  completed_at timestamptz
);

-- ─── APPOINTMENTS ────────────────────────────────────────────
create table if not exists appointments (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references leads(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  title text not null,
  notes text,
  scheduled_at timestamptz not null,
  duration_minutes integer default 60,
  status text default 'scheduled' check (status in ('scheduled','confirmed','cancelled','completed','no_show')),
  reminder_sent boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── KNOWLEDGE BASE ──────────────────────────────────────────
create table if not exists knowledge_documents (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  content text not null,
  source text,
  tags text[] default '{}',
  active boolean default true,
  created_at timestamptz default now()
);

-- ─── USERS (internal team members) ───────────────────────────
create table if not exists team_members (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid unique,
  name text not null,
  email text unique not null,
  role text default 'agent' check (role in ('owner','admin','manager','agent','support')),
  avatar_url text,
  phone text,
  whatsapp_notifications boolean default false,
  status text default 'offline' check (status in ('online','away','offline')),
  open_conversation_count integer default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- ─── INDEXES ────────────────────────────────────────────────
create index if not exists idx_messages_conversation on messages(conversation_id);
create index if not exists idx_messages_wa_id on messages(wa_message_id);
create index if not exists idx_messages_created on messages(created_at desc);
create index if not exists idx_conversations_status on conversations(status);
create index if not exists idx_conversations_contact on conversations(contact_id);
create index if not exists idx_conversations_updated on conversations(updated_at desc);
create index if not exists idx_leads_stage on leads(stage);
create index if not exists idx_leads_score on leads(ai_score desc);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_due on tasks(due_date);
create index if not exists idx_ai_requests_created on ai_requests(created_at desc);

-- ─── REALTIME ────────────────────────────────────────────────
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table tasks;

-- ─── ROW LEVEL SECURITY (enable for all tables) ───────────────
alter table contacts enable row level security;
alter table leads enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table tasks enable row level security;
alter table ai_requests enable row level security;
alter table agents enable row level security;
alter table workflows enable row level security;
alter table workflow_runs enable row level security;
alter table appointments enable row level security;
alter table knowledge_documents enable row level security;
alter table team_members enable row level security;

-- Service role bypass (for API routes using service key)
create policy "Service role full access" on contacts for all using (auth.role() = 'service_role');
create policy "Service role full access" on leads for all using (auth.role() = 'service_role');
create policy "Service role full access" on conversations for all using (auth.role() = 'service_role');
create policy "Service role full access" on messages for all using (auth.role() = 'service_role');
create policy "Service role full access" on tasks for all using (auth.role() = 'service_role');
create policy "Service role full access" on ai_requests for all using (auth.role() = 'service_role');
create policy "Service role full access" on agents for all using (auth.role() = 'service_role');
create policy "Service role full access" on workflows for all using (auth.role() = 'service_role');
create policy "Service role full access" on workflow_runs for all using (auth.role() = 'service_role');
create policy "Service role full access" on appointments for all using (auth.role() = 'service_role');
create policy "Service role full access" on knowledge_documents for all using (auth.role() = 'service_role');
create policy "Service role full access" on team_members for all using (auth.role() = 'service_role');

-- Authenticated users can read all
create policy "Auth read contacts" on contacts for select using (auth.role() = 'authenticated');
create policy "Auth read leads" on leads for select using (auth.role() = 'authenticated');
create policy "Auth read conversations" on conversations for select using (auth.role() = 'authenticated');
create policy "Auth read messages" on messages for select using (auth.role() = 'authenticated');
create policy "Auth read tasks" on tasks for select using (auth.role() = 'authenticated');
create policy "Auth read appointments" on appointments for select using (auth.role() = 'authenticated');
create policy "Auth read workflows" on workflows for select using (auth.role() = 'authenticated');
create policy "Auth read agents" on agents for select using (auth.role() = 'authenticated');
create policy "Auth read knowledge" on knowledge_documents for select using (auth.role() = 'authenticated');
create policy "Auth read members" on team_members for select using (auth.role() = 'authenticated');

-- Authenticated users write
create policy "Auth write contacts" on contacts for insert with check (auth.role() = 'authenticated');
create policy "Auth update contacts" on contacts for update using (auth.role() = 'authenticated');
create policy "Auth write leads" on leads for insert with check (auth.role() = 'authenticated');
create policy "Auth update leads" on leads for update using (auth.role() = 'authenticated');
create policy "Auth write tasks" on tasks for insert with check (auth.role() = 'authenticated');
create policy "Auth update tasks" on tasks for update using (auth.role() = 'authenticated');
create policy "Auth write messages" on messages for insert with check (auth.role() = 'authenticated');
create policy "Auth update conversations" on conversations for update using (auth.role() = 'authenticated');
create policy "Auth write appointments" on appointments for insert with check (auth.role() = 'authenticated');
create policy "Auth update appointments" on appointments for update using (auth.role() = 'authenticated');
create policy "Auth write agents" on agents for insert with check (auth.role() = 'authenticated');
create policy "Auth update agents" on agents for update using (auth.role() = 'authenticated');
create policy "Auth write workflows" on workflows for insert with check (auth.role() = 'authenticated');
create policy "Auth update workflows" on workflows for update using (auth.role() = 'authenticated');

-- ─── DEFAULT DATA ─────────────────────────────────────────────
insert into agents (name, description, provider, model, system_prompt, temperature, active) values
(
  'Lead Qualifier',
  'Qualifies incoming leads by extracting intent, budget and urgency from WhatsApp conversations',
  'openai',
  'gpt-4o-mini',
  'You are a lead qualification AI for a premium bridal and fashion boutique. Your job is to analyze WhatsApp conversations and extract structured lead information.

Always respond with valid JSON only, no explanation text. Extract:
- intent: string (bridal_purchase|saree_purchase|casual_browse|gift|event_wear|inquiry)
- budget: number in INR (null if unknown)
- urgency: string (low|medium|high)
- timeline: string (e.g. "1_month", "3_months", null)
- sentiment: string (positive|neutral|negative)
- ai_score: integer 0-100
- confidence: float 0-1
- summary: string (1-2 sentence summary of the conversation)
- suggested_reply: string (a warm, professional reply to continue the conversation)
- suggested_tags: string[] (relevant tags)
- create_task: boolean (should a follow-up task be created?)
- task_title: string|null (if create_task is true)',
  0.3,
  true
),
(
  'Reply Suggester',
  'Generates contextual reply suggestions for agents based on conversation history',
  'openai',
  'gpt-4o',
  'You are an expert sales assistant for a premium bridal and fashion boutique. Generate 2-3 warm, professional WhatsApp reply suggestions for the agent.

Rules:
- Keep replies conversational and human, never robotic
- Be warm, empathetic and enthusiastic about helping
- Suggest replies that move toward a sale or appointment
- Use emojis sparingly and naturally
- Write in the same language as the customer
- Respond with JSON: {"suggestions": [{"text": "...", "label": "..."}]}',
  0.7,
  true
),
(
  'Summary Generator',
  'Creates AI summaries of conversations and leads',
  'openai',
  'gpt-4o-mini',
  'You are a CRM summarization AI. Given a conversation or lead record, generate a concise 2-3 sentence business summary covering: who the customer is, what they want, current status, and recommended next action. Respond in plain text, no JSON.',
  0.3,
  true
);

insert into workflows (name, description, trigger_type, trigger_config, steps, active) values
(
  'Hot Lead Alert',
  'Instantly notifies when AI score exceeds 80',
  'lead_score',
  '{"threshold": 80}',
  '[
    {"type": "notify", "config": {"message": "🔥 Hot lead detected: {{lead.name}} scored {{lead.ai_score}}/100"}},
    {"type": "create_task", "config": {"title": "Follow up with {{lead.name}} — high purchase intent", "priority": "urgent", "due_hours": 1}},
    {"type": "ai_reply", "config": {"agent": "Reply Suggester"}}
  ]',
  true
),
(
  'Inactivity Follow-up',
  'Auto follow-up if no reply in 3 days',
  'inactivity',
  '{"hours": 72}',
  '[
    {"type": "ai_reply", "config": {"agent": "Reply Suggester", "context": "re-engagement"}},
    {"type": "create_task", "config": {"title": "Follow up: {{contact.name}} inactive 3 days", "priority": "high", "due_hours": 2}},
    {"type": "notify", "config": {"message": "⚠️ Lead {{contact.name}} has been inactive for 3 days"}}
  ]',
  true
),
(
  'Appointment Reminder',
  'Send reminder 24h before appointment',
  'appointment',
  '{"hours_before": 24}',
  '[
    {"type": "send_whatsapp", "config": {"template": "appointment_reminder"}},
    {"type": "update_appointment", "config": {"reminder_sent": true}}
  ]',
  true
);
