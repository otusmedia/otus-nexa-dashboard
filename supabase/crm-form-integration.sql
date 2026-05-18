-- Per-client CRM form → external CRM (webhook / HubSpot / Pipedrive / RD Station)

alter table clients add column if not exists crm_integration jsonb default '{}'::jsonb;

-- Optional audit mirror for agency visibility
alter table crm_leads add column if not exists client_slug text;
alter table crm_leads add column if not exists external_id text;
alter table crm_leads add column if not exists form_payload jsonb;

create index if not exists crm_leads_client_slug_idx on crm_leads (client_slug);
