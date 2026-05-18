-- Per-client hero background + granular API toggles

alter table clients add column if not exists hero_image_url text;
alter table clients add column if not exists api_config jsonb default '{}'::jsonb;

update clients
set hero_image_url = '/Biotecc%20-%202026-159.jpg'
where slug = 'rocketride' and (hero_image_url is null or hero_image_url = '');

update clients
set api_config = '{
  "metaAds": true,
  "metaCampaigns": true,
  "metaMonthlySpend": true,
  "metaCreatives": true,
  "instagramFeed": true,
  "instagramInsights": true,
  "instagramMonthly": true,
  "ga4": true
}'::jsonb
where slug = 'rocketride'
  and (api_config is null or api_config = '{}'::jsonb);

update clients set api_enabled = true where slug = 'rocketride';

-- Storage bucket for client logos/hero images (public read)
insert into storage.buckets (id, name, public)
values ('client-assets', 'client-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "client_assets_public_read" on storage.objects;
create policy "client_assets_public_read" on storage.objects
  for select to public using (bucket_id = 'client-assets');

drop policy if exists "client_assets_anon_all" on storage.objects;
create policy "client_assets_anon_all" on storage.objects
  for all to anon using (bucket_id = 'client-assets') with check (bucket_id = 'client-assets');
