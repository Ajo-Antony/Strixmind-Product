-- ============================================================
-- MISSING TABLES MIGRATION
-- Run this in the Supabase SQL Editor AFTER the main schema.sql
-- Adds: campaigns, campaign_leads, notifications, organizations,
--       billing_events, message_retry_queue, ai_logs
-- ============================================================

-- ── Organizations (for billing / multi-tenant) ──────────────
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Business',
  plan text not null default 'starter' check (plan in ('starter','growth','pro','enterprise')),
  billing_period_start timestamptz default date_trunc('month', now()),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Seed a default org so billing/usage checks work out of the box
insert into organizations (id, name, plan)
values ('00000000-0000-0000-0000-000000000001', 'StrixMind', 'growth')
on conflict (id) do nothing;

-- ── Billing Events ───────────────────────────────────────────
create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  event_type text not null,   -- checkout_initiated | subscription_activated | invoice_paid | ...
  plan_id text,
  amount numeric(10,2),
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- ── Campaigns ────────────────────────────────────────────────
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft','active','paused','completed')),
  -- Rolling metrics (updated by computeCampaignMetrics)
  open_rate numeric(5,2) default 0,
  reply_rate numeric(5,2) default 0,
  conversion_rate numeric(5,2) default 0,
  metrics jsonb default '{}',            -- { sent, delivered, read, replied, converted }
  ai_optimisation_suggestion text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Campaign → Lead join table ───────────────────────────────
create table if not exists campaign_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  status text default 'pending'
    check (status in ('pending','sent','delivered','replied','converted')),
  sent_at timestamptz,
  replied_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz default now(),
  unique(campaign_id, lead_id)
);

-- ── Notifications ────────────────────────────────────────────
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,           -- hot_lead | handoff_assigned | task_due | appointment_reminder | ...
  title text not null,
  body text,
  recipient text,               -- user_id or null = broadcast
  lead_id uuid references leads(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  channels text[] default '{"dashboard"}',
  metadata jsonb default '{}',
  read boolean default false,
  created_at timestamptz default now()
);

-- ── WhatsApp Message Retry Queue ─────────────────────────────
create table if not exists message_retry_queue (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  contact_phone text not null,
  message_type text not null default 'text' check (message_type in ('text','template')),
  content text not null,
  template_name text,
  template_variables text[] default '{}',
  error_code text not null default 'UNKNOWN',
  error_message text default '',
  attempt_count integer default 0,
  max_attempts integer default 4,
  next_attempt_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending','retrying','succeeded','failed','escalated')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── AI Cost / Usage Logs ─────────────────────────────────────
-- ai_requests already exists in main schema; ai_logs is an alias/extended table
create table if not exists ai_logs (
  id uuid primary key default gen_random_uuid(),
  provider text,
  model text,
  prompt_tokens integer default 0,
  completion_tokens integer default 0,
  total_tokens integer default 0,
  cost_usd numeric(10,6) default 0,
  latency_ms integer,
  task_type text,
  conversation_id uuid references conversations(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  created_at timestamptz default now()
);

-- ── Products (for billing plan display) ──────────────────────
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_monthly numeric(10,2),
  price_yearly numeric(10,2),
  features jsonb default '[]',
  stripe_product_id text,
  stripe_price_id_monthly text,
  stripe_price_id_yearly text,
  active boolean default true,
  created_at timestamptz default now()
);

-- ── Enable RLS ───────────────────────────────────────────────
alter table organizations        enable row level security;
alter table billing_events       enable row level security;
alter table campaigns            enable row level security;
alter table campaign_leads       enable row level security;
alter table notifications        enable row level security;
alter table message_retry_queue  enable row level security;
alter table ai_logs              enable row level security;
alter table products             enable row level security;

-- ── Service role full access ─────────────────────────────────
create policy "Service role full access" on organizations        for all using (auth.role() = 'service_role');
create policy "Service role full access" on billing_events       for all using (auth.role() = 'service_role');
create policy "Service role full access" on campaigns            for all using (auth.role() = 'service_role');
create policy "Service role full access" on campaign_leads       for all using (auth.role() = 'service_role');
create policy "Service role full access" on notifications        for all using (auth.role() = 'service_role');
create policy "Service role full access" on message_retry_queue  for all using (auth.role() = 'service_role');
create policy "Service role full access" on ai_logs              for all using (auth.role() = 'service_role');
create policy "Service role full access" on products             for all using (auth.role() = 'service_role');

-- ── Authenticated read access ────────────────────────────────
create policy "Auth read campaigns"           on campaigns           for select using (auth.role() = 'authenticated');
create policy "Auth read campaign_leads"      on campaign_leads      for select using (auth.role() = 'authenticated');
create policy "Auth read notifications"       on notifications       for select using (auth.role() = 'authenticated');
create policy "Auth read products"            on products            for select using (auth.role() = 'authenticated');
create policy "Auth read organizations"       on organizations       for select using (auth.role() = 'authenticated');

-- ── Authenticated write access ───────────────────────────────
create policy "Auth write campaigns"          on campaigns           for insert  with check (auth.role() = 'authenticated');
create policy "Auth update campaigns"         on campaigns           for update  using (auth.role() = 'authenticated');
create policy "Auth delete campaigns"         on campaigns           for delete  using (auth.role() = 'authenticated');
create policy "Auth write campaign_leads"     on campaign_leads      for insert  with check (auth.role() = 'authenticated');
create policy "Auth update notifications"     on notifications       for update  using (auth.role() = 'authenticated');

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists idx_campaigns_status         on campaigns(status);
create index if not exists idx_campaign_leads_campaign  on campaign_leads(campaign_id);
create index if not exists idx_campaign_leads_lead      on campaign_leads(lead_id);
create index if not exists idx_notifications_recipient  on notifications(recipient);
create index if not exists idx_notifications_read       on notifications(read);
create index if not exists idx_notifications_created    on notifications(created_at desc);
create index if not exists idx_retry_queue_status       on message_retry_queue(status, next_attempt_at);
create index if not exists idx_ai_logs_created          on ai_logs(created_at desc);
create index if not exists idx_ai_logs_provider         on ai_logs(provider);

-- ── trigger: auto-update updated_at ──────────────────────────
-- Reuses the update_updated_at function from the main schema
create trigger campaigns_updated_at
  before update on campaigns
  for each row execute function update_updated_at();

create trigger message_retry_queue_updated_at
  before update on message_retry_queue
  for each row execute function update_updated_at();

-- ── Seed: sample campaign ────────────────────────────────────
insert into campaigns (name, description, status)
values ('Diwali Sale', 'Bulk outreach for festive season offers', 'paused')
on conflict do nothing;
