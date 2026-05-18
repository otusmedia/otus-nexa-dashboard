-- Multi-client support migration

create table if not exists clients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text default '#FF4500',
  active boolean default true,
  api_enabled boolean default false,
  created_at timestamptz default now()
);

alter table clients enable row level security;
drop policy if exists "Allow anon clients" on clients;
create policy "Allow anon clients" on clients for all to anon using (true) with check (true);

insert into clients (name, slug, primary_color, api_enabled)
values ('RocketRide', 'rocketride', '#FF4500', true)
on conflict (slug) do update set api_enabled = true;

alter table app_users add column if not exists client_slug text;

update app_users set client_slug = 'rocketride' where company = 'rocketride' and (client_slug is null or client_slug = '');

alter table projects add column if not exists client_slug text;
alter table tasks add column if not exists client_slug text;
alter table marketing_projects add column if not exists client_slug text;

update projects set client_slug = 'rocketride' where client_slug is null;
update tasks set client_slug = 'rocketride' where client_slug is null and project_id is not null;
update marketing_projects set client_slug = 'rocketride' where client_slug is null;
