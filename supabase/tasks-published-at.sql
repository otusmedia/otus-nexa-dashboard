-- Run in Supabase SQL editor if `tasks.published_at` is missing (used for publication date in task table).
alter table tasks add column if not exists published_at timestamptz;
