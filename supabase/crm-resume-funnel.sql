-- Separate sales vs resume (HR) funnels on the same crm_leads table.

alter table crm_leads add column if not exists funnel text not null default 'sales';

create index if not exists crm_leads_client_funnel_idx on crm_leads (client_slug, funnel);
