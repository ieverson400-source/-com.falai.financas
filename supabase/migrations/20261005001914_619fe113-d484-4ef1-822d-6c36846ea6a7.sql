CREATE TABLE public.push_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'web' CHECK (platform IN ('web','android','ios')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own push tokens" ON public.push_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users register own push tokens" ON public.push_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own push tokens" ON public.push_tokens FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own push tokens" ON public.push_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all push tokens" ON public.push_tokens FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_push_tokens_updated_at BEFORE UPDATE ON public.push_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX push_tokens_user_idx ON public.push_tokens(user_id);
CREATE INDEX push_tokens_last_seen_idx ON public.push_tokens(last_seen_at);

ALTER TABLE public.notification_logs
  ADD COLUMN title text,
  ADD COLUMN body text,
  ADD COLUMN sent_by uuid,
  ADD COLUMN total_sent integer NOT NULL DEFAULT 0 CHECK (total_sent >= 0),
  ADD COLUMN total_failed integer NOT NULL DEFAULT 0 CHECK (total_failed >= 0);
CREATE INDEX notification_logs_push_idx ON public.notification_logs(notification_type, created_at DESC);