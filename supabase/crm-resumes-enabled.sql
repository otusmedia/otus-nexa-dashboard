-- Disable resumes funnel for Biotecc (optional — can also toggle in client settings UI).
update clients
set crm_integration = coalesce(crm_integration, '{}'::jsonb) || '{"resumesEnabled": false}'::jsonb
where slug = 'biotecc'
  and coalesce(crm_integration->>'resumesEnabled', 'true') != 'false';
