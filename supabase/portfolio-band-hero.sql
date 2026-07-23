-- Title + tagline for the light highlights band parallax hero.
alter table portfolio_pages
  add column if not exists draft_band_title text not null default 'Studio.',
  add column if not exists draft_band_tagline text not null default
    'Films and visual stories for brands that want work that looks good and feels effortless.',
  add column if not exists live_band_title text not null default '',
  add column if not exists live_band_tagline text not null default '';
