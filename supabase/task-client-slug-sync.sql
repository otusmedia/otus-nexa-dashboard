-- Keep tasks.client_slug aligned with parent project (run after client-data-isolation.sql).

update tasks t
set client_slug = p.client_slug
from projects p
where t.project_id = p.id
  and p.client_slug is not null
  and (t.client_slug is null or t.client_slug = '' or t.client_slug <> p.client_slug);

-- Optional trigger for new/updated tasks
create or replace function sync_task_client_slug_from_project()
returns trigger as $$
begin
  if new.project_id is not null then
    select client_slug into new.client_slug
    from projects
    where id = new.project_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_sync_client_slug on tasks;
create trigger tasks_sync_client_slug
  before insert or update of project_id on tasks
  for each row execute function sync_task_client_slug_from_project();
