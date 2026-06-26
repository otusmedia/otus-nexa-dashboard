-- CRM lead service/product type (creatable select, per client).

alter table crm_leads
  add column if not exists service_product text;

create table if not exists crm_custom_service_products (
  id uuid default gen_random_uuid() primary key,
  client_slug text not null,
  service_product text not null,
  created_at timestamptz default now()
);

create unique index if not exists crm_custom_service_products_client_sp_uidx
  on crm_custom_service_products (client_slug, lower(service_product));

create index if not exists crm_custom_service_products_client_slug_idx
  on crm_custom_service_products (client_slug);

alter table crm_custom_service_products enable row level security;

drop policy if exists "Allow anon crm_custom_service_products" on crm_custom_service_products;
create policy "Allow anon crm_custom_service_products" on crm_custom_service_products
  for all to anon using (true) with check (true);
