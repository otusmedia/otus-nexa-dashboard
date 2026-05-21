-- CRM appointment completion log (seller marks "call lead" etc. as done)

alter table crm_appointments add column if not exists status text default 'pending';
alter table crm_appointments add column if not exists completed_at timestamptz;
alter table crm_appointments add column if not exists completed_by text;

update crm_appointments set status = 'pending' where status is null or status = '';

create index if not exists crm_appointments_status_idx on crm_appointments (status);
create index if not exists crm_appointments_completed_at_idx on crm_appointments (completed_at);
