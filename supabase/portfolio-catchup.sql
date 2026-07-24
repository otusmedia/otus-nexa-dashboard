-- Catch-up: all additive portfolio columns the app expects.
-- Paste into Supabase → SQL Editor → Run (safe: IF NOT EXISTS).

-- Hero (Savee)
alter table portfolio_pages
  add column if not exists draft_hero_headline text not null default
    'Films and visual stories for brands that want work that looks good and feels effortless.',
  add column if not exists draft_hero_primary_cta jsonb not null default
    '{"label":"View work","anchor":"work"}'::jsonb,
  add column if not exists draft_hero_secondary_cta jsonb not null default
    '{"label":"Get in touch","anchor":"about"}'::jsonb,
  add column if not exists draft_hero_stats jsonb not null default
    '[
      {"id":"s1","value":"50+","label":"Projects"},
      {"id":"s2","value":"10+","label":"Years"},
      {"id":"s3","value":"Worldwide","label":"Clients"},
      {"id":"s4","value":"Cinema","label":"Craft"}
    ]'::jsonb,
  add column if not exists live_hero_headline text not null default '',
  add column if not exists live_hero_primary_cta jsonb not null default '{}'::jsonb,
  add column if not exists live_hero_secondary_cta jsonb not null default '{}'::jsonb,
  add column if not exists live_hero_stats jsonb not null default '[]'::jsonb;

-- Highlights
alter table portfolio_pages
  add column if not exists draft_highlights jsonb not null default '[]'::jsonb,
  add column if not exists live_highlights jsonb not null default '[]'::jsonb;

-- Band title/tagline (fixes: live_band_tagline missing)
alter table portfolio_pages
  add column if not exists draft_band_title text not null default 'Studio.',
  add column if not exists draft_band_tagline text not null default
    'Films and visual stories for brands that want work that looks good and feels effortless.',
  add column if not exists live_band_title text not null default '',
  add column if not exists live_band_tagline text not null default '';

-- About content + section visibility
alter table portfolio_pages
  add column if not exists draft_about_content jsonb not null default '{}'::jsonb,
  add column if not exists live_about_content jsonb not null default '{}'::jsonb,
  add column if not exists draft_sections jsonb not null default
    '{"hero":true,"work":true,"highlights":true,"about":true}'::jsonb,
  add column if not exists live_sections jsonb not null default
    '{"hero":true,"work":true,"highlights":true,"about":true}'::jsonb;

-- Project page fields
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

-- Project summary fields
alter table portfolio_items
  add column if not exists draft_problem text not null default '',
  add column if not exists draft_solution text not null default '',
  add column if not exists draft_challenge text not null default '',
  add column if not exists draft_result text not null default '',
  add column if not exists live_problem text,
  add column if not exists live_solution text,
  add column if not exists live_challenge text,
  add column if not exists live_result text;
