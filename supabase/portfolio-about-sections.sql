-- Rich About section + which LP sections are visible to visitors.
alter table portfolio_pages
  add column if not exists draft_about_content jsonb not null default '{}'::jsonb,
  add column if not exists live_about_content jsonb not null default '{}'::jsonb,
  add column if not exists draft_sections jsonb not null default
    '{"hero":true,"work":true,"highlights":true,"about":true}'::jsonb,
  add column if not exists live_sections jsonb not null default
    '{"hero":true,"work":true,"highlights":true,"about":true}'::jsonb;
