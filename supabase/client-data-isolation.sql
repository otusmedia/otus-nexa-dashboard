-- Isolate legacy data under RocketRide; keep new clients (e.g. Grupo Elo) empty except welcome project.

alter table clients add column if not exists api_enabled boolean default false;

update clients set api_enabled = true where slug = 'rocketride';
update clients set api_enabled = false where slug <> 'rocketride';

-- All historical rows belong to RocketRide unless tied to a non-welcome Grupo Elo project (cleaned below).
update projects set client_slug = 'rocketride' where client_slug is null or client_slug = '';

update tasks set client_slug = 'rocketride' where client_slug is null or client_slug = '';

update marketing_projects set client_slug = 'rocketride' where client_slug is null or client_slug = '';

-- Remove any Grupo Elo (or other new client) data except the onboarding welcome project.
delete from tasks
where client_slug is not null
  and client_slug <> 'rocketride'
  and project_id in (
    select id from projects
    where client_slug is not null
      and client_slug <> 'rocketride'
      and name not like 'Welcome — %'
  );

delete from tasks
where client_slug is not null
  and client_slug <> 'rocketride'
  and project_id is null;

delete from projects
where client_slug is not null
  and client_slug <> 'rocketride'
  and name not like 'Welcome — %';

delete from marketing_projects where client_slug is not null and client_slug <> 'rocketride';

-- Sync task client_slug from parent project.
update tasks t
set client_slug = p.client_slug
from projects p
where t.project_id = p.id
  and p.client_slug is not null;

-- Orphan platform tasks stay on RocketRide.
update tasks set client_slug = 'rocketride' where project_id is null;

-- Scope shared modules to RocketRide (legacy rows without slug).
alter table invoices add column if not exists client_slug text;
alter table files add column if not exists client_slug text;
alter table contracts add column if not exists client_slug text;
alter table campaigns add column if not exists client_slug text;
alter table notes add column if not exists client_slug text;
alter table scheduled_posts add column if not exists client_slug text;
alter table calendar_events add column if not exists client_slug text;
alter table client_updates add column if not exists client_slug text;
alter table folders add column if not exists client_slug text;

update invoices set client_slug = 'rocketride' where client_slug is null or client_slug = '';
update files set client_slug = 'rocketride' where client_slug is null or client_slug = '';
update contracts set client_slug = 'rocketride' where client_slug is null or client_slug = '';
update campaigns set client_slug = 'rocketride' where client_slug is null or client_slug = '';
update notes set client_slug = 'rocketride' where client_slug is null or client_slug = '';
update scheduled_posts set client_slug = 'rocketride' where client_slug is null or client_slug = '';
update calendar_events set client_slug = 'rocketride' where client_slug is null or client_slug = '';
update client_updates set client_slug = 'rocketride' where client_slug is null or client_slug = '';
update folders set client_slug = 'rocketride' where client_slug is null or client_slug = '';

delete from campaigns where client_slug is not null and client_slug <> 'rocketride';
delete from notes where client_slug is not null and client_slug <> 'rocketride';
delete from client_updates where client_slug is not null and client_slug <> 'rocketride';
delete from scheduled_posts where client_slug is not null and client_slug <> 'rocketride';
delete from calendar_events where client_slug is not null and client_slug <> 'rocketride';
delete from invoices where client_slug is not null and client_slug <> 'rocketride';
delete from files where client_slug is not null and client_slug <> 'rocketride';
delete from contracts where client_slug is not null and client_slug <> 'rocketride';

-- Users: only explicit client accounts keep non-rocketride slug.
update app_users
set client_slug = company
where company is not null
  and company not in ('nexa', 'otus', '')
  and (client_slug is null or client_slug = '');
