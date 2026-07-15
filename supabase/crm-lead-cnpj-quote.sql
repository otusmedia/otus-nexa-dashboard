-- Optional CNPJ + quote/orçamento attachment metadata on CRM leads.

alter table crm_leads add column if not exists cnpj text;
alter table crm_leads add column if not exists quote_url text;
alter table crm_leads add column if not exists quote_name text;

-- Storage for lead quote PDFs / files (public read for download links)
insert into storage.buckets (id, name, public)
values ('crm-lead-files', 'crm-lead-files', true)
on conflict (id) do update set public = true;

drop policy if exists "crm_lead_files_public_read" on storage.objects;
create policy "crm_lead_files_public_read" on storage.objects
  for select to public using (bucket_id = 'crm-lead-files');

drop policy if exists "crm_lead_files_anon_all" on storage.objects;
create policy "crm_lead_files_anon_all" on storage.objects
  for all to anon using (bucket_id = 'crm-lead-files') with check (bucket_id = 'crm-lead-files');
