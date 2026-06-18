-- Per-client module provisioning (Nexa configures once; client admins distribute to their users).
alter table clients add column if not exists enabled_modules text[];

-- Grupo Elo: enable full client portal suite (adjust per client as needed).
update clients
set enabled_modules = array[
  'dashboard','projects','financial','updates','marketing',
  'content-management','calendar','crm','files','contracts'
]::text[]
where slug = 'grupo-elo'
  and (enabled_modules is null or cardinality(enabled_modules) = 0);
