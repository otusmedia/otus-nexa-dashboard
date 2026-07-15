-- Per-user hero world clocks (1–2 cities). Example: {"cityIds":["san-francisco","curitiba"]}
alter table app_users add column if not exists hero_clocks jsonb default null;
