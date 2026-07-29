-- Moodboards: many per account, each with a public share_slug.
-- Public URL: /m/s/[share_slug]
--
-- Prerequisite: accounts-foundation.sql (public.accounts).
-- Safe to re-run. Migrates legacy moodboard_pages (1 per account) if present.

create table if not exists moodboards (
  id uuid default gen_random_uuid() primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  name text not null default 'Moodboard',
  share_slug text not null,
  draft_logo_url text,
  draft_title text not null default '',
  draft_subtitle text not null default 'MoodBoard & Direção Visual',
  draft_date_label text not null default '',
  draft_locais jsonb not null default '[]'::jsonb,
  live_logo_url text,
  live_title text,
  live_subtitle text,
  live_date_label text,
  live_locais jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint moodboards_share_slug_nonempty check (length(trim(share_slug)) > 0)
);

create unique index if not exists moodboards_share_slug_lower_idx
  on moodboards (lower(share_slug));

create index if not exists moodboards_account_updated_idx
  on moodboards (account_id, updated_at desc);

create table if not exists moodboard_items (
  id uuid default gen_random_uuid() primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  moodboard_id uuid references moodboards(id) on delete cascade,
  draft_media_url text not null default '',
  draft_width integer,
  draft_height integer,
  draft_sort_order integer not null default 0,
  live_media_url text,
  live_width integer,
  live_height integer,
  live_sort_order integer,
  in_live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If moodboard_items already existed without moodboard_id, add it.
alter table moodboard_items
  add column if not exists moodboard_id uuid references moodboards(id) on delete cascade;

create index if not exists moodboard_items_board_draft_order_idx
  on moodboard_items (moodboard_id, draft_sort_order);

create index if not exists moodboard_items_board_live_order_idx
  on moodboard_items (moodboard_id, live_sort_order)
  where in_live = true;

-- Migrate legacy one-page-per-account rows into moodboards.
do $$
declare
  r record;
  new_id uuid;
  slug text;
begin
  if to_regclass('public.moodboard_pages') is null then
    return;
  end if;

  for r in
    select *
    from moodboard_pages p
    where not exists (
      select 1 from moodboards m where m.account_id = p.account_id
    )
  loop
    slug := 'mb-' || substr(replace(r.account_id::text, '-', ''), 1, 12);
    insert into moodboards (
      account_id, name, share_slug,
      draft_logo_url, draft_title, draft_subtitle, draft_date_label,
      live_logo_url, live_title, live_subtitle, live_date_label,
      published_at, updated_at
    )
    values (
      r.account_id,
      coalesce(nullif(trim(r.draft_title), ''), 'Moodboard'),
      slug,
      r.draft_logo_url,
      coalesce(r.draft_title, ''),
      coalesce(r.draft_subtitle, 'MoodBoard & Direção Visual'),
      coalesce(r.draft_date_label, ''),
      r.live_logo_url,
      r.live_title,
      r.live_subtitle,
      r.live_date_label,
      r.published_at,
      coalesce(r.updated_at, now())
    )
    returning id into new_id;

    update moodboard_items
    set moodboard_id = new_id
    where account_id = r.account_id
      and moodboard_id is null;
  end loop;
end $$;

alter table moodboards enable row level security;
alter table moodboard_items enable row level security;

drop policy if exists "Allow anon moodboards" on moodboards;
create policy "Allow anon moodboards" on moodboards for all to anon using (true) with check (true);

drop policy if exists "Allow anon moodboard_items" on moodboard_items;
create policy "Allow anon moodboard_items" on moodboard_items for all to anon using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit)
values ('moodboard-media', 'moodboard-media', true, 31457280)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "moodboard media public read" on storage.objects;
create policy "moodboard media public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'moodboard-media');

drop policy if exists "moodboard media anon write" on storage.objects;
create policy "moodboard media anon write"
  on storage.objects for all to anon
  using (bucket_id = 'moodboard-media')
  with check (bucket_id = 'moodboard-media');
