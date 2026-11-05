-- Destructive cleanup approved in the cleanup plan.
-- Apply through the managed migration tool only after deploying compatible code.
-- No CASCADE: unexpected external dependencies must abort the migration.
DROP TABLE IF EXISTS public.pluggy_transactions;
DROP TABLE IF EXISTS public.pluggy_sync_logs;
DROP TABLE IF EXISTS public.pluggy_webhook_events;
DROP TABLE IF EXISTS public.pluggy_accounts;
DROP TABLE IF EXISTS public.pluggy_items;
DROP TABLE IF EXISTS public.recargas;
DROP TABLE IF EXISTS public.recarga_settings;
DROP TABLE IF EXISTS public.whatsapp_inbox;
DROP TABLE IF EXISTS public.whatsapp_unmapped_numbers;
DROP TABLE IF EXISTS public.whatsapp_templates;
DROP TABLE IF EXISTS public.chat_messages;
DROP TABLE IF EXISTS public.notification_logs;
DROP TABLE IF EXISTS public.webhooks;