-- Run this in Supabase SQL Editor
-- Tracks every lead-intake webhook event + pipeline results

create table if not exists lead_intake_log (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid references leads(id) on delete cascade,
  email           text,
  phone           text,
  full_name       text,
  source          text default 'website',
  raw_payload     jsonb,
  status          text default 'received',   -- received | processed | failed
  thank_you_sent  boolean default false,
  team_notified   boolean default false,
  apollo_enriched boolean default false,
  hubspot_id      text,
  processed_at    timestamptz,
  created_at      timestamptz default now()
);

-- Index for dashboard queries
create index if not exists lead_intake_log_lead_id_idx on lead_intake_log(lead_id);
create index if not exists lead_intake_log_created_at_idx on lead_intake_log(created_at desc);

-- RLS: service role only (this table is internal)
alter table lead_intake_log enable row level security;
create policy "service_role_all" on lead_intake_log
  for all using (auth.role() = 'service_role');
