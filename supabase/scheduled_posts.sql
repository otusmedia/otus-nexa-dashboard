-- Run in Supabase SQL Editor
create table if not exists scheduled_posts (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  platforms text[] not null,
  media_urls text[] default '{}',
  scheduled_at timestamptz,
  status text default 'draft',
  created_by text,
  published_at timestamptz,
  created_at timestamptz default now()
);

alter table scheduled_posts enable row level security;
create policy "Allow anon scheduled_posts" on scheduled_posts for all to anon using (true) with check (true);

-- Linked project task + optional media note (run in Supabase SQL editor if table already exists)
alter table scheduled_posts add column if not exists linked_task_id uuid references tasks (id);
alter table scheduled_posts add column if not exists media_description text;
