-- Savee-style portfolio hero: headline, CTAs, social proof stats (draft + live).
-- Additive; keeps legacy hero media columns unused by the new UI.

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
