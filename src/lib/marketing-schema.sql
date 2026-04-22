-- Marketing module schema (strategy, campaigns, reports)
-- Generated from Supabase table usage in:
-- /marketing/strategy, /marketing/campaigns, /marketing/reports

create table if not exists marketing_strategy (
  id uuid default gen_random_uuid() primary key,
  content text,
  updated_by text,
  updated_at timestamptz default now()
);

create table if not exists marketing_projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text,
  status text default 'Planning',
  progress integer default 0,
  budget numeric default 0,
  budget_used numeric default 0,
  results integer default 0,
  impressions integer default 0,
  clicks integer default 0,
  owner text,
  start_date date,
  end_date date,
  campaign_period_start date,
  campaign_period_end date,
  description text,
  tags text[],
  created_at timestamptz default now()
);

create table if not exists marketing_tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references marketing_projects(id) on delete cascade,
  title text not null,
  description text,
  status text default 'Not Started',
  priority text default 'Medium',
  assigned_to text,
  due_date date,
  is_featured boolean default false,
  cover_image text,
  short_description text,
  reminder_at timestamptz,
  reminder_note text,
  created_at timestamptz default now()
);

create table if not exists marketing_folders (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists marketing_files (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text,
  size text,
  folder_id uuid,
  uploaded_by text,
  url text,
  created_at timestamptz default now()
);

alter table marketing_strategy enable row level security;
alter table marketing_projects enable row level security;
alter table marketing_tasks enable row level security;
alter table marketing_folders enable row level security;
alter table marketing_files enable row level security;

drop policy if exists "mkt_strategy_select_v1" on marketing_strategy;
create policy "mkt_strategy_select_v1" on marketing_strategy
for select
using (true);

drop policy if exists "mkt_strategy_insert_v1" on marketing_strategy;
create policy "mkt_strategy_insert_v1" on marketing_strategy
for insert
with check (true);

drop policy if exists "mkt_strategy_update_v1" on marketing_strategy;
create policy "mkt_strategy_update_v1" on marketing_strategy
for update
using (true)
with check (true);

drop policy if exists "mkt_projects_select_v1" on marketing_projects;
create policy "mkt_projects_select_v1" on marketing_projects
for select
using (true);

drop policy if exists "mkt_projects_insert_v1" on marketing_projects;
create policy "mkt_projects_insert_v1" on marketing_projects
for insert
with check (true);

drop policy if exists "mkt_projects_update_v1" on marketing_projects;
create policy "mkt_projects_update_v1" on marketing_projects
for update
using (true)
with check (true);

drop policy if exists "mkt_projects_delete_v1" on marketing_projects;
create policy "mkt_projects_delete_v1" on marketing_projects
for delete
using (true);

drop policy if exists "mkt_tasks_select_v1" on marketing_tasks;
create policy "mkt_tasks_select_v1" on marketing_tasks
for select
using (true);

drop policy if exists "mkt_tasks_insert_v1" on marketing_tasks;
create policy "mkt_tasks_insert_v1" on marketing_tasks
for insert
with check (true);

drop policy if exists "mkt_tasks_update_v1" on marketing_tasks;
create policy "mkt_tasks_update_v1" on marketing_tasks
for update
using (true)
with check (true);

drop policy if exists "mkt_tasks_delete_v1" on marketing_tasks;
create policy "mkt_tasks_delete_v1" on marketing_tasks
for delete
using (true);

drop policy if exists "mkt_folders_select_v1" on marketing_folders;
create policy "mkt_folders_select_v1" on marketing_folders
for select
using (true);

drop policy if exists "mkt_folders_insert_v1" on marketing_folders;
create policy "mkt_folders_insert_v1" on marketing_folders
for insert
with check (true);

drop policy if exists "mkt_folders_update_v1" on marketing_folders;
create policy "mkt_folders_update_v1" on marketing_folders
for update
using (true)
with check (true);

drop policy if exists "mkt_folders_delete_v1" on marketing_folders;
create policy "mkt_folders_delete_v1" on marketing_folders
for delete
using (true);

drop policy if exists "mkt_files_select_v1" on marketing_files;
create policy "mkt_files_select_v1" on marketing_files
for select
using (true);

drop policy if exists "mkt_files_insert_v1" on marketing_files;
create policy "mkt_files_insert_v1" on marketing_files
for insert
with check (true);

drop policy if exists "mkt_files_update_v1" on marketing_files;
create policy "mkt_files_update_v1" on marketing_files
for update
using (true)
with check (true);

drop policy if exists "mkt_files_delete_v1" on marketing_files;
create policy "mkt_files_delete_v1" on marketing_files
for delete
using (true);

alter table marketing_projects add column if not exists meta_campaign_id text;
alter table marketing_projects add column if not exists last_synced_at timestamptz;
