-- Per-client default UI locale + optional user preference

alter table clients add column if not exists default_locale text not null default 'en'
  check (default_locale in ('en', 'pt-BR'));

alter table app_users add column if not exists locale_preference text
  check (locale_preference is null or locale_preference in ('en', 'pt-BR'));

update clients set default_locale = 'en' where slug = 'rocketride';
update clients set default_locale = 'pt-BR' where slug = 'grupo-elo';

-- Cache for on-read content translation (updates, comments)
create table if not exists content_translations (
  content_hash text not null,
  source_locale text not null,
  target_locale text not null,
  translated_text text not null,
  created_at timestamptz default now(),
  primary key (content_hash, source_locale, target_locale)
);

alter table content_translations enable row level security;
drop policy if exists "Allow anon content_translations" on content_translations;
create policy "Allow anon content_translations" on content_translations
  for all to anon using (true) with check (true);

alter table client_updates add column if not exists content_locale text
  check (content_locale is null or content_locale in ('en', 'pt-BR'));

alter table project_comments add column if not exists content_locale text
  check (content_locale is null or content_locale in ('en', 'pt-BR'));
