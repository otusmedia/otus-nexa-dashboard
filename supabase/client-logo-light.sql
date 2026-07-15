-- Per-theme client logos: logo_url = dark theme; logo_light_url = light theme.
alter table clients add column if not exists logo_light_url text;
