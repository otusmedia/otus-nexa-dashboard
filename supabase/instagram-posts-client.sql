-- Per-client Instagram feed (manual posts) + public storage for images.

alter table instagram_posts add column if not exists client_slug text;
alter table instagram_posts add column if not exists shares integer default 0;

create index if not exists instagram_posts_client_slug_idx on instagram_posts (client_slug);

insert into storage.buckets (id, name, public)
values ('instagram-feed', 'instagram-feed', true)
on conflict (id) do update set public = true;

drop policy if exists "instagram_feed_public_read" on storage.objects;
create policy "instagram_feed_public_read"
  on storage.objects for select
  using (bucket_id = 'instagram-feed');

drop policy if exists "instagram_feed_anon_insert" on storage.objects;
create policy "instagram_feed_anon_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'instagram-feed');

drop policy if exists "instagram_feed_anon_update" on storage.objects;
create policy "instagram_feed_anon_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'instagram-feed');

drop policy if exists "instagram_feed_anon_delete" on storage.objects;
create policy "instagram_feed_anon_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'instagram-feed');
