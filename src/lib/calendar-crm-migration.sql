-- Run in Supabase SQL editor (CRM + calendar integration)
alter table calendar_events add column if not exists source text;
alter table calendar_events add column if not exists source_id uuid;
alter table calendar_events add column if not exists lead_id uuid;
alter table calendar_events add column if not exists lead_name text;
