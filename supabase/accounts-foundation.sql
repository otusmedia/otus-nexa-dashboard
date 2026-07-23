-- Phase 0: accounts foundation for filmmaker SaaS evolution.
-- Additive only — does not alter existing client_slug flows.
-- Convention: storage_limit_bytes / video_minutes_limit NULL = unlimited.

create table if not exists accounts (
  id uuid default gen_random_uuid() primary key,
  kind text not null check (kind in ('agency_client', 'filmmaker')),
  name text not null,
  public_slug text unique,
  plan text not null default 'free'
    check (plan in ('free', 'base', 'pro', 'complete', 'agency')),
  storage_used_bytes bigint not null default 0,
  storage_limit_bytes bigint,
  video_minutes_used integer not null default 0,
  video_minutes_limit integer,
  brand_primary_color text,
  brand_logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_public_slug_filmmaker_only
    check (public_slug is null or kind = 'filmmaker')
);

create index if not exists accounts_kind_idx on accounts (kind);
create index if not exists accounts_plan_idx on accounts (plan);
create unique index if not exists accounts_public_slug_lower_idx
  on accounts (lower(public_slug))
  where public_slug is not null;

create table if not exists account_members (
  account_id uuid not null references accounts(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create index if not exists account_members_user_id_idx on account_members (user_id);

alter table clients add column if not exists account_id uuid references accounts(id);

create index if not exists clients_account_id_idx on clients (account_id);

-- Backfill: one agency_client account per existing client (NULL limits = unlimited).
do $$
declare
  r record;
  new_id uuid;
begin
  for r in
    select id, name from clients where account_id is null order by created_at nulls last, name
  loop
    insert into accounts (kind, name, plan, storage_used_bytes, storage_limit_bytes, video_minutes_used, video_minutes_limit)
    values ('agency_client', r.name, 'agency', 0, null, 0, null)
    returning id into new_id;
    update clients set account_id = new_id where id = r.id;
  end loop;
end $$;

-- Auto-create account for new clients.
create or replace function public.clients_ensure_account()
returns trigger
language plpgsql
as $$
declare
  new_account_id uuid;
begin
  if new.account_id is not null then
    return new;
  end if;
  insert into accounts (kind, name, plan, storage_used_bytes, storage_limit_bytes, video_minutes_used, video_minutes_limit)
  values ('agency_client', new.name, 'agency', 0, null, 0, null)
  returning id into new_account_id;
  new.account_id := new_account_id;
  return new;
end;
$$;

drop trigger if exists clients_ensure_account_trg on clients;
create trigger clients_ensure_account_trg
  before insert on clients
  for each row
  execute function public.clients_ensure_account();

-- Keep account name in sync when client name changes (agency_client only).
create or replace function public.clients_sync_account_name()
returns trigger
language plpgsql
as $$
begin
  if new.account_id is not null and new.name is distinct from old.name then
    update accounts
    set name = new.name, updated_at = now()
    where id = new.account_id and kind = 'agency_client';
  end if;
  return new;
end;
$$;

drop trigger if exists clients_sync_account_name_trg on clients;
create trigger clients_sync_account_name_trg
  after update of name on clients
  for each row
  execute function public.clients_sync_account_name();

alter table accounts enable row level security;
alter table account_members enable row level security;

drop policy if exists "Allow anon accounts" on accounts;
create policy "Allow anon accounts" on accounts for all to anon using (true) with check (true);

drop policy if exists "Allow anon account_members" on account_members;
create policy "Allow anon account_members" on account_members for all to anon using (true) with check (true);
