-- Project-level comments (run in Supabase SQL editor if not already applied)
alter table projects add column if not exists owners text default '';

create table if not exists project_comments (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  user_name text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table project_comments enable row level security;
create policy "Allow anon project_comments" on project_comments for all to anon using (true) with check (true);

-- For realtime: Supabase Dashboard → Database → Replication → enable project_comments
