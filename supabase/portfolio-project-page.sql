-- Rich project page fields (subtitle, meta, about, gallery) on portfolio_items.
alter table portfolio_items
  add column if not exists draft_subtitle text not null default '',
  add column if not exists draft_role text not null default '',
  add column if not exists draft_client text not null default '',
  add column if not exists draft_year text not null default '',
  add column if not exists draft_about_text text not null default '',
  add column if not exists draft_gallery jsonb not null default '[]'::jsonb,
  add column if not exists live_subtitle text,
  add column if not exists live_role text,
  add column if not exists live_client text,
  add column if not exists live_year text,
  add column if not exists live_about_text text,
  add column if not exists live_gallery jsonb;
