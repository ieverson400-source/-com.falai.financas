CREATE TABLE public.recargas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  telefone text NOT NULL,
  operadora text NOT NULL,
  valor numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider_response jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recargas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own recargas" ON public.recargas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own recargas" ON public.recargas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own recargas" ON public.recargas FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_recargas_updated_at
  BEFORE UPDATE ON public.recargas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_recargas_user_created ON public.recargas (user_id, created_at DESC);