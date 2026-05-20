CREATE TABLE public.recarga_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'simulado',
  api_url text,
  api_key text,
  real_mode boolean NOT NULL DEFAULT false,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recarga_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own recarga settings" ON public.recarga_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own recarga settings" ON public.recarga_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own recarga settings" ON public.recarga_settings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own recarga settings" ON public.recarga_settings
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_recarga_settings_updated_at
  BEFORE UPDATE ON public.recarga_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();