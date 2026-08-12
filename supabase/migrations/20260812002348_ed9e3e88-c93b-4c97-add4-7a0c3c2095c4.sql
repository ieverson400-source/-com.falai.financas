CREATE TABLE IF NOT EXISTS public.pluggy_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_id text,
  event_type text NOT NULL,
  item_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pluggy_webhook_events_event_id_key
  ON public.pluggy_webhook_events (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pluggy_webhook_events_item_idx
  ON public.pluggy_webhook_events (item_id);

GRANT SELECT ON public.pluggy_webhook_events TO authenticated;
GRANT ALL ON public.pluggy_webhook_events TO service_role;

ALTER TABLE public.pluggy_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own webhook events"
  ON public.pluggy_webhook_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
