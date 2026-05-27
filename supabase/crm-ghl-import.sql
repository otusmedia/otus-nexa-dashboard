-- Go High Level import: dedupe contacts by external_id

alter table crm_contacts add column if not exists external_id text;

create unique index if not exists crm_contacts_client_external_uidx
  on crm_contacts (client_slug, external_id)
  where external_id is not null;

create unique index if not exists crm_leads_client_external_uidx
  on crm_leads (client_slug, external_id)
  where external_id is not null;
