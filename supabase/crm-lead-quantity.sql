-- CRM: lead quantity + unit.
-- Paste into Supabase → SQL Editor → Run.

alter table crm_leads
  add column if not exists quantity integer;

alter table crm_leads
  add column if not exists quantity_unit text;
