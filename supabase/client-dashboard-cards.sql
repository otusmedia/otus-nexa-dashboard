-- Per-client dashboard card visibility (Nexa admin toggles which blocks show on /dashboard).
alter table clients add column if not exists dashboard_cards jsonb default '{}'::jsonb;
