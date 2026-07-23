-- Project case-study summary: problem, solution, challenge, result.
alter table portfolio_items
  add column if not exists draft_problem text not null default '',
  add column if not exists draft_solution text not null default '',
  add column if not exists draft_challenge text not null default '',
  add column if not exists draft_result text not null default '',
  add column if not exists live_problem text,
  add column if not exists live_solution text,
  add column if not exists live_challenge text,
  add column if not exists live_result text;
