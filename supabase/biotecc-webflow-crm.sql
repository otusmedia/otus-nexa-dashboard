-- Biotecc: Site funnel + Webflow form routing (same pattern as Grupo Elo).
-- Run after crm-custom-funnels.sql and crm-form-integration.sql.

insert into crm_funnels (client_slug, slug, name, sort_order)
values ('biotecc', 'site', 'Site', 2)
on conflict (client_slug, slug) do update set name = excluded.name;

insert into crm_funnel_stages (funnel_id, name, sort_order, dot_class)
select f.id, stage.name, stage.sort_order, stage.dot_class
from crm_funnels f
cross join (
  values
    ('New Lead', 0, 'bg-blue-500'),
    ('In Contact', 1, 'bg-yellow-400'),
    ('Proposal Sent', 2, 'bg-purple-500'),
    ('Won', 3, 'bg-emerald-500')
) as stage(name, sort_order, dot_class)
where f.client_slug = 'biotecc'
  and f.slug = 'site'
  and not exists (
    select 1
    from crm_funnel_stages s
    where s.funnel_id = f.id and lower(s.name) = lower(stage.name)
  );

update clients
set crm_integration = coalesce(crm_integration, '{}'::jsonb)
  || jsonb_build_object(
    'provider', 'nexa',
    'defaultFunnelSlug', 'site',
    'defaultSource', 'Site'
  )
where slug = 'biotecc';

-- Grupo Elo reference (only fills defaults when missing).
insert into crm_funnels (client_slug, slug, name, sort_order)
values ('grupo-elo', 'site', 'Site', 2)
on conflict (client_slug, slug) do update set name = excluded.name;

insert into crm_funnel_stages (funnel_id, name, sort_order, dot_class)
select f.id, stage.name, stage.sort_order, stage.dot_class
from crm_funnels f
cross join (
  values
    ('New Lead', 0, 'bg-blue-500'),
    ('In Contact', 1, 'bg-yellow-400'),
    ('Proposal Sent', 2, 'bg-purple-500'),
    ('Won', 3, 'bg-emerald-500')
) as stage(name, sort_order, dot_class)
where f.client_slug = 'grupo-elo'
  and f.slug = 'site'
  and not exists (
    select 1
    from crm_funnel_stages s
    where s.funnel_id = f.id and lower(s.name) = lower(stage.name)
  );

update clients
set crm_integration = coalesce(crm_integration, '{}'::jsonb)
  || jsonb_build_object(
    'defaultFunnelSlug', coalesce(crm_integration->>'defaultFunnelSlug', 'site'),
    'defaultSource', coalesce(crm_integration->>'defaultSource', 'Website')
  )
where slug = 'grupo-elo'
  and (crm_integration->>'defaultFunnelSlug' is null or crm_integration->>'defaultSource' is null);
