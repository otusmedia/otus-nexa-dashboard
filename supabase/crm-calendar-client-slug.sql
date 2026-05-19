-- CRM appointments → calendar_events must carry the same client_slug as the lead.
-- Without this, client users (e.g. Grupo Elo) do not see meetings on their calendar.

update calendar_events ce
set client_slug = l.client_slug
from crm_leads l
where ce.source = 'crm'
  and ce.lead_id = l.id
  and l.client_slug is not null
  and (ce.client_slug is null or ce.client_slug is distinct from l.client_slug);

-- Re-link invitees for CRM owners (optional; run after app_users has emails)
update calendar_event_invitees cei
set
  user_id = u.id,
  email = coalesce(nullif(trim(cei.email), ''), u.email)
from calendar_events ce
join crm_leads l on l.id = ce.lead_id
join app_users u on lower(trim(u.name)) = lower(trim(
  regexp_replace(coalesce(ce.description, ''), '(?m)^Owner:\s*(.+)$', '\1')
))
where ce.id = cei.event_id
  and ce.source = 'crm'
  and cei.user_id is null
  and u.email is not null;
