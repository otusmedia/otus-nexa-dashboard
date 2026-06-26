-- Per-client WhatsApp chat widget (group invite link + display copy).
alter table clients add column if not exists whatsapp_config jsonb default '{}'::jsonb;
