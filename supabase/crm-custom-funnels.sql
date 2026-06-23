-- Custom CRM funnels per client (stages + user access).

create table if not exists crm_funnels (
  id uuid default gen_random_uuid() primary key,
  client_slug text not null,
  slug text not null,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create unique index if not exists crm_funnels_client_slug_uidx on crm_funnels (client_slug, slug);
create index if not exists crm_funnels_client_slug_idx on crm_funnels (client_slug);

create table if not exists crm_funnel_stages (
  id uuid default gen_random_uuid() primary key,
  funnel_id uuid not null references crm_funnels (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  dot_class text not null default 'bg-blue-500',
  created_at timestamptz default now()
);

create unique index if not exists crm_funnel_stages_funnel_name_uidx on crm_funnel_stages (funnel_id, lower(name));
create index if not exists crm_funnel_stages_funnel_id_idx on crm_funnel_stages (funnel_id);

create table if not exists crm_funnel_access (
  funnel_id uuid not null references crm_funnels (id) on delete cascade,
  user_id text not null,
  primary key (funnel_id, user_id)
);

create index if not exists crm_funnel_access_user_id_idx on crm_funnel_access (user_id);

alter table crm_funnels enable row level security;
alter table crm_funnel_stages enable row level security;
alter table crm_funnel_access enable row level security;

drop policy if exists "Allow anon crm_funnels" on crm_funnels;
create policy "Allow anon crm_funnels" on crm_funnels for all to anon using (true) with check (true);

drop policy if exists "Allow anon crm_funnel_stages" on crm_funnel_stages;
create policy "Allow anon crm_funnel_stages" on crm_funnel_stages for all to anon using (true) with check (true);

drop policy if exists "Allow anon crm_funnel_access" on crm_funnel_access;
create policy "Allow anon crm_funnel_access" on crm_funnel_access for all to anon using (true) with check (true);
