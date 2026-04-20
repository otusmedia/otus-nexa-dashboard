create table if not exists projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text,
  status text default 'Planning',
  progress integer default 0,
  owner text,
  start_date date,
  end_date date,
  description text,
  created_at timestamptz default now()
);

create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  description text,
  status text default 'Not Started',
  priority text default 'Medium',
  assigned_to text,
  due_date date,
  is_featured boolean default false,
  cover_image text,
  short_description text,
  created_at timestamptz default now()
);

create table if not exists invoices (
  id uuid default gen_random_uuid() primary key,
  project_name text,
  filename text,
  amount numeric default 0,
  status text default 'pending',
  issue_date date,
  due_date date,
  file_url text,
  created_at timestamptz default now()
);

create table if not exists files (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text,
  size text,
  folder_id uuid,
  uploaded_by text,
  url text,
  created_at timestamptz default now()
);

create table if not exists folders (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists contracts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  status text default 'draft',
  file_url text,
  file_size text,
  page_count integer,
  uploaded_at timestamptz default now()
);

create table if not exists campaigns (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  status text default 'backlog',
  created_at timestamptz default now()
);

create table if not exists notes (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  author text,
  created_at timestamptz default now()
);

create table if not exists reports (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text,
  file_url text,
  uploaded_at timestamptz default now()
);

create table if not exists activity (
  id uuid default gen_random_uuid() primary key,
  action text not null,
  user_name text,
  created_at timestamptz default now()
);

create table if not exists creatives (
  id uuid default gen_random_uuid() primary key,
  name text,
  platform text,
  ad_url text,
  ctr numeric default 0,
  impressions integer default 0,
  image_url text,
  created_at timestamptz default now()
);

create table if not exists instagram_posts (
  id uuid default gen_random_uuid() primary key,
  image_url text,
  likes integer default 0,
  comments integer default 0,
  caption text,
  created_at timestamptz default now()
);

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
  owner text,
  start_date date,
  end_date date,
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

drop policy if exists "marketing_strategy_select" on marketing_strategy;
create policy "marketing_strategy_select" on marketing_strategy for select using (true);
drop policy if exists "marketing_strategy_insert" on marketing_strategy;
create policy "marketing_strategy_insert" on marketing_strategy for insert with check (true);
drop policy if exists "marketing_strategy_update" on marketing_strategy;
create policy "marketing_strategy_update" on marketing_strategy for update using (true) with check (true);

drop policy if exists "marketing_projects_select" on marketing_projects;
create policy "marketing_projects_select" on marketing_projects for select using (true);
drop policy if exists "marketing_projects_insert" on marketing_projects;
create policy "marketing_projects_insert" on marketing_projects for insert with check (true);
drop policy if exists "marketing_projects_update" on marketing_projects;
create policy "marketing_projects_update" on marketing_projects for update using (true) with check (true);
drop policy if exists "marketing_projects_delete" on marketing_projects;
create policy "marketing_projects_delete" on marketing_projects for delete using (true);

drop policy if exists "marketing_tasks_select" on marketing_tasks;
create policy "marketing_tasks_select" on marketing_tasks for select using (true);
drop policy if exists "marketing_tasks_insert" on marketing_tasks;
create policy "marketing_tasks_insert" on marketing_tasks for insert with check (true);
drop policy if exists "marketing_tasks_update" on marketing_tasks;
create policy "marketing_tasks_update" on marketing_tasks for update using (true) with check (true);
drop policy if exists "marketing_tasks_delete" on marketing_tasks;
create policy "marketing_tasks_delete" on marketing_tasks for delete using (true);

drop policy if exists "marketing_folders_select" on marketing_folders;
create policy "marketing_folders_select" on marketing_folders for select using (true);
drop policy if exists "marketing_folders_insert" on marketing_folders;
create policy "marketing_folders_insert" on marketing_folders for insert with check (true);
drop policy if exists "marketing_folders_update" on marketing_folders;
create policy "marketing_folders_update" on marketing_folders for update using (true) with check (true);
drop policy if exists "marketing_folders_delete" on marketing_folders;
create policy "marketing_folders_delete" on marketing_folders for delete using (true);

drop policy if exists "marketing_files_select" on marketing_files;
create policy "marketing_files_select" on marketing_files for select using (true);
drop policy if exists "marketing_files_insert" on marketing_files;
create policy "marketing_files_insert" on marketing_files for insert with check (true);
drop policy if exists "marketing_files_update" on marketing_files;
create policy "marketing_files_update" on marketing_files for update using (true) with check (true);
drop policy if exists "marketing_files_delete" on marketing_files;
create policy "marketing_files_delete" on marketing_files for delete using (true);

alter table marketing_projects add column if not exists budget numeric default 0;
alter table marketing_projects add column if not exists budget_used numeric default 0;
alter table marketing_projects add column if not exists results integer default 0;
alter table marketing_projects add column if not exists campaign_period_start date;
alter table marketing_projects add column if not exists campaign_period_end date;
alter table marketing_projects add column if not exists impressions integer default 0;
alter table marketing_projects add column if not exists clicks integer default 0;

alter table marketing_tasks add column if not exists reminder_at timestamptz;
alter table marketing_tasks add column if not exists reminder_note text;
