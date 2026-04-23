-- Run in Supabase SQL Editor alongside app seed alignment.
-- Update legacy Joe row if present; insert Aaron if missing.

update app_users
set
  name = 'Joe Maiochi',
  email = 'joe.maionchi@rocketride.ai',
  company = 'rocketride',
  role = 'admin',
  modules = array['dashboard','projects','financial','files','contracts']::text[]
where email = 'joe@rocketride.io'
   or (name ilike 'Joe' and company = 'rocketride');

insert into app_users (name, email, company, role, modules)
select 'Aaron Jimenez',
       'aaron.jimenez@rocketride.ai',
       'rocketride',
       'manager',
       array['projects','files','contracts']::text[]
where not exists (
  select 1 from app_users where email ilike 'aaron.jimenez@rocketride.ai'
);
