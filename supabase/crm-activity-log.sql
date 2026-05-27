-- Audit log for CRM events (appointment completed, future imports, etc.)

create table if not exists crm_activity_log (
  id uuid default gen_random_uuid() primary key,
  client_slug text,
  lead_id uuid references crm_leads(id) on delete cascade,
  appointment_id uuid references crm_appointments(id) on delete set null,
  event_type text not null,
  actor_name text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists crm_activity_log_lead_id_idx on crm_activity_log (lead_id);
create index if not exists crm_activity_log_client_slug_idx on crm_activity_log (client_slug);
create index if not exists crm_activity_log_created_at_idx on crm_activity_log (created_at desc);

alter table crm_activity_log enable row level security;

drop policy if exists "Allow anon crm_activity_log" on crm_activity_log;
create policy "Allow anon crm_activity_log" on crm_activity_log for all to anon using (true) with check (true);
