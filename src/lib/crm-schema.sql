create table if not exists crm_leads (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  company text,
  email text,
  phone text,
  status text default 'New Lead',
  owner text,
  source text,
  value numeric default 0,
  description text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_appointments (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid references crm_leads(id) on delete cascade,
  title text not null,
  date date,
  time time,
  description text,
  owner text,
  created_at timestamptz default now()
);

create table if not exists crm_contacts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  company text,
  email text,
  phone text,
  role text,
  source text,
  notes text,
  created_at timestamptz default now()
);

alter table crm_leads enable row level security;
alter table crm_appointments enable row level security;
alter table crm_contacts enable row level security;

create policy "Allow anon crm_leads" on crm_leads for all to anon using (true) with check (true);
create policy "Allow anon crm_appointments" on crm_appointments for all to anon using (true) with check (true);
create policy "Allow anon crm_contacts" on crm_contacts for all to anon using (true) with check (true);
