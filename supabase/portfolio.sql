-- Portfolio site (editable landing): draft vs live, scoped by account_id only.
-- Public URL: /p/[accounts.public_slug] for kind=filmmaker only.

create table if not exists portfolio_pages (
  account_id uuid primary key references accounts(id) on delete cascade,
  -- draft
  draft_logo_url text,
  draft_nav_items jsonb not null default '[{"id":"work","label":"Work","anchor":"work"},{"id":"about","label":"About","anchor":"about"}]'::jsonb,
  draft_cta_label text not null default 'Get in touch',
  draft_hero_media_type text check (draft_hero_media_type is null or draft_hero_media_type in ('image', 'video')),
  draft_hero_media_url text,
  draft_about_text text not null default '',
  draft_about_image_url text,
  -- live (public)
  live_logo_url text,
  live_nav_items jsonb not null default '[]'::jsonb,
  live_cta_label text not null default 'Get in touch',
  live_hero_media_type text check (live_hero_media_type is null or live_hero_media_type in ('image', 'video')),
  live_hero_media_url text,
  live_about_text text not null default '',
  live_about_image_url text,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists portfolio_items (
  id uuid default gen_random_uuid() primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  -- draft
  draft_title text not null default '',
  draft_cover_media_type text check (draft_cover_media_type is null or draft_cover_media_type in ('image', 'video')),
  draft_cover_media_url text,
  draft_description text not null default '',
  draft_sort_order integer not null default 0,
  draft_aspect text not null default 'landscape'
    check (draft_aspect in ('portrait', 'landscape', 'square')),
  -- live
  live_title text,
  live_cover_media_type text check (live_cover_media_type is null or live_cover_media_type in ('image', 'video')),
  live_cover_media_url text,
  live_description text,
  live_sort_order integer,
  live_aspect text check (live_aspect is null or live_aspect in ('portrait', 'landscape', 'square')),
  in_live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portfolio_items_account_draft_order_idx
  on portfolio_items (account_id, draft_sort_order);

create index if not exists portfolio_items_account_live_order_idx
  on portfolio_items (account_id, live_sort_order)
  where in_live = true;

alter table portfolio_pages enable row level security;
alter table portfolio_items enable row level security;

drop policy if exists "Allow anon portfolio_pages" on portfolio_pages;
create policy "Allow anon portfolio_pages" on portfolio_pages for all to anon using (true) with check (true);

drop policy if exists "Allow anon portfolio_items" on portfolio_items;
create policy "Allow anon portfolio_items" on portfolio_items for all to anon using (true) with check (true);

-- Public portfolio media (published site content). Deliveries remain private/signed.
insert into storage.buckets (id, name, public, file_size_limit)
values ('portfolio-media', 'portfolio-media', true, 31457280)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "portfolio media public read" on storage.objects;
create policy "portfolio media public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'portfolio-media');

drop policy if exists "portfolio media anon write" on storage.objects;
create policy "portfolio media anon write"
  on storage.objects for all to anon
  using (bucket_id = 'portfolio-media')
  with check (bucket_id = 'portfolio-media');
