-- Per-client project board statuses (Kanban columns).
-- Additive; defaults live in app code until a client saves a custom set.

create table if not exists project_board_statuses (
  id uuid default gen_random_uuid() primary key,
  client_slug text not null,
  name text not null,
  sort_order integer not null default 0,
  dot_class text not null default 'bg-blue-500',
  created_at timestamptz not null default now(),
  unique (client_slug, name)
);

create index if not exists project_board_statuses_client_slug_idx
  on project_board_statuses (client_slug, sort_order);

alter table project_board_statuses enable row level security;

drop policy if exists "Allow anon project_board_statuses" on project_board_statuses;
create policy "Allow anon project_board_statuses"
  on project_board_statuses for all to anon using (true) with check (true);
