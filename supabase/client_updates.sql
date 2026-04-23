-- Run in Supabase SQL Editor. Create Storage bucket "updates-attachments" (public) in Dashboard > Storage.

create table if not exists client_updates (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  category text not null,
  author_name text not null,
  is_pinned boolean default false not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists update_attachments (
  id uuid default gen_random_uuid() primary key,
  update_id uuid not null references client_updates (id) on delete cascade,
  file_name text not null,
  file_url text not null,
  storage_path text not null,
  mime_type text,
  created_at timestamptz default now()
);

create index if not exists update_attachments_update_id_idx on update_attachments (update_id);
create index if not exists client_updates_created_at_idx on client_updates (created_at desc);

alter table client_updates enable row level security;
alter table update_attachments enable row level security;

create policy "Allow anon client_updates select" on client_updates for select to anon using (true);
create policy "Allow anon client_updates insert" on client_updates for insert to anon with check (true);
create policy "Allow anon client_updates update" on client_updates for update to anon using (true) with check (true);
create policy "Allow anon client_updates delete" on client_updates for delete to anon using (true);

create policy "Allow anon update_attachments select" on update_attachments for select to anon using (true);
create policy "Allow anon update_attachments insert" on update_attachments for insert to anon with check (true);
create policy "Allow anon update_attachments delete" on update_attachments for delete to anon using (true);
