-- CRM: lead quantity + sentence-case service/product labels.
-- Paste into Supabase → SQL Editor → Run.

alter table crm_leads
  add column if not exists quantity integer;

-- First letter upper, rest lower (UTF-8).
create or replace function public.format_crm_service_product(raw text)
returns text
language sql
immutable
as $$
  select case
    when raw is null or btrim(raw) = '' then null
    else upper(left(btrim(regexp_replace(raw, '\s+', ' ', 'g')), 1))
      || lower(substr(btrim(regexp_replace(raw, '\s+', ' ', 'g')), 2))
  end;
$$;

-- Normalize catalog labels.
update crm_custom_service_products
set service_product = public.format_crm_service_product(service_product)
where service_product is distinct from public.format_crm_service_product(service_product);

-- Drop duplicates created by case-only differences (keep oldest).
delete from crm_custom_service_products a
using crm_custom_service_products b
where a.client_slug = b.client_slug
  and lower(a.service_product) = lower(b.service_product)
  and a.created_at > b.created_at;

-- Normalize labels already saved on leads.
update crm_leads
set service_product = public.format_crm_service_product(service_product)
where service_product is not null
  and service_product is distinct from public.format_crm_service_product(service_product);
