-- Per-client API credentials (tokens / account IDs). Falls back to server env when empty.

alter table clients add column if not exists api_credentials jsonb default '{}'::jsonb;

-- Optional: seed RocketRide from env is done in app on first save; legacy rows use env fallback in code.
