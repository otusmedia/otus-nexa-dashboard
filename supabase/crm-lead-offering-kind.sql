-- CRM: service vs product offering on leads + catalog kind.
-- Paste into Supabase → SQL Editor → Run.

alter table crm_leads
  add column if not exists offering_kind text;

alter table crm_custom_service_products
  add column if not exists kind text not null default 'product';

-- Known facility services → service kind
update crm_custom_service_products
set kind = 'service'
where kind = 'product'
  and lower(btrim(service_product)) in (
    'limpeza',
    'portaria',
    'vigilância',
    'vigilancia'
  );

-- Unique per client + kind + label
drop index if exists crm_custom_service_products_client_sp_uidx;
create unique index if not exists crm_custom_service_products_client_kind_sp_uidx
  on crm_custom_service_products (client_slug, kind, lower(service_product));

create index if not exists crm_custom_service_products_client_kind_idx
  on crm_custom_service_products (client_slug, kind);
