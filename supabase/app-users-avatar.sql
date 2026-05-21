-- Profile avatars for app_users (custom app auth — storage policies use anon role)

alter table app_users add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_anon_insert" on storage.objects;
create policy "avatars_anon_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "avatars_anon_update" on storage.objects;
create policy "avatars_anon_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars_anon_delete" on storage.objects;
create policy "avatars_anon_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'avatars');
