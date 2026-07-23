-- Portfolio LP highlights slider (draft + live), below Work grid.
alter table portfolio_pages
  add column if not exists draft_highlights jsonb not null default '[]'::jsonb,
  add column if not exists live_highlights jsonb not null default '[]'::jsonb;
