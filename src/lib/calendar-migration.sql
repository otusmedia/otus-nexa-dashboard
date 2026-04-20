-- Calendar module — run in Supabase SQL editor
-- Optional: set created_by only when using Supabase Auth (JWT). Nullable for app-only sessions.

create table if not exists calendar_events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean default false,
  type text check (type in ('event', 'meeting', 'deadline', 'other')) default 'event',
  meet_link text,
  location text,
  color text default '#ef4444',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists calendar_event_invitees (
  id uuid default gen_random_uuid() primary key,
  event_id uuid not null references calendar_events (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  email text,
  status text check (status in ('pending', 'accepted', 'declined')) default 'pending',
  created_at timestamptz default now()
);

create index if not exists calendar_events_start_at_idx on calendar_events (start_at);
create index if not exists calendar_event_invitees_event_idx on calendar_event_invitees (event_id);

alter table calendar_events enable row level security;
alter table calendar_event_invitees enable row level security;

-- Development / anon key: permissive policies (matches other tables in this project).
-- Production: replace with auth.uid() and row-level rules as needed.

create policy "calendar_events_select" on calendar_events for select using (true);
create policy "calendar_events_insert" on calendar_events for insert with check (true);
create policy "calendar_events_update" on calendar_events for update using (true);
create policy "calendar_events_delete" on calendar_events for delete using (true);

create policy "calendar_event_invitees_select" on calendar_event_invitees for select using (true);
create policy "calendar_event_invitees_insert" on calendar_event_invitees for insert with check (true);
create policy "calendar_event_invitees_update" on calendar_event_invitees for update using (true);
create policy "calendar_event_invitees_delete" on calendar_event_invitees for delete using (true);
