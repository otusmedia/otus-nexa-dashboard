-- Per-client custom CRM lead sources (typed once, then selectable).

create table if not exists crm_custom_sources (
  id uuid default gen_random_uuid() primary key,
  client_slug text not null,
  source text not null,
  created_at timestamptz default now()
);

create unique index if not exists crm_custom_sources_client_source_uidx
  on crm_custom_sources (client_slug, lower(source));

create index if not exists crm_custom_sources_client_slug_idx on crm_custom_sources (client_slug);

alter table crm_custom_sources enable row level security;

drop policy if exists "Allow anon crm_custom_sources" on crm_custom_sources;
create policy "Allow anon crm_custom_sources" on crm_custom_sources for all to anon using (true) with check (true);
