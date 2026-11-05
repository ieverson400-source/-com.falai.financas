CREATE TABLE public.internal_secrets (name text PRIMARY KEY, value text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON public.internal_secrets FROM anon, authenticated;
GRANT ALL ON public.internal_secrets TO service_role;
ALTER TABLE public.internal_secrets ENABLE ROW LEVEL SECURITY;
INSERT INTO public.internal_secrets(name, value) VALUES ('cron', encode(extensions.gen_random_bytes(32), 'hex')) ON CONFLICT DO NOTHING;