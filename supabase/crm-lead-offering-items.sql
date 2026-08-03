-- CRM: multiple product/service lines on a lead (quote/budget).
-- Paste into Supabase → SQL Editor → Run.

alter table crm_leads
  add column if not exists offering_items jsonb not null default '[]'::jsonb;

-- Backfill single-line offerings from legacy columns.
update crm_leads
set offering_items = jsonb_build_array(
  jsonb_strip_nulls(
    jsonb_build_object(
      'name', nullif(btrim(coalesce(service_product, '')), ''),
      'quantity', quantity,
      'quantity_unit', nullif(btrim(coalesce(quantity_unit, '')), '')
    )
  )
)
where coalesce(jsonb_array_length(offering_items), 0) = 0
  and nullif(btrim(coalesce(service_product, '')), '') is not null;
