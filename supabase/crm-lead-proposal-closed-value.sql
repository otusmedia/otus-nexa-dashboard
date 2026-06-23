-- Split lead value into proposal vs closed amounts.

alter table crm_leads add column if not exists proposal_value numeric default 0;
alter table crm_leads add column if not exists closed_value numeric default 0;

update crm_leads set proposal_value = coalesce(proposal_value, 0) where proposal_value is null;
update crm_leads set closed_value = coalesce(closed_value, 0) where closed_value is null;

alter table crm_leads alter column proposal_value set default 0;
alter table crm_leads alter column closed_value set default 0;
