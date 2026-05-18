-- Per-client CRM form → external CRM (webhook / HubSpot / Pipedrive / RD Station)

alter table clients add column if not exists crm_integration jsonb default '{}'::jsonb;

-- Optional audit mirror for agency visibility
alter table crm_leads add column if not exists client_slug text;
alter table crm_leads add column if not exists external_id text;
alter table crm_leads add column if not exists form_payload jsonb;

create index if not exists crm_leads_client_slug_idx on crm_leads (client_slug);

-- Website leads also create rows in Contacts (crm_contacts)
alter table crm_contacts add column if not exists client_slug text;
create index if not exists crm_contacts_client_slug_idx on crm_contacts (client_slug);

-- Backfill contacts from existing website leads (safe to re-run)
insert into crm_contacts (name, company, email, phone, role, source, notes, client_slug)
select
  l.name,
  l.company,
  l.email,
  l.phone,
  null,
  coalesce(l.source, 'Website'),
  trim(
    concat_ws(
      E'\n\n',
      'Auto-created from website form (backfill).',
      'Lead ID: ' || l.id::text,
      nullif(trim(l.description), '')
    )
  ),
  l.client_slug
from crm_leads l
where l.client_slug is not null
  and nullif(trim(l.email), '') is not null
  and not exists (
    select 1
    from crm_contacts c
    where c.client_slug = l.client_slug
      and lower(trim(c.email)) = lower(trim(l.email))
  );
