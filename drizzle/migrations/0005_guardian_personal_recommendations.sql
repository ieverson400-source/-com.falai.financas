CREATE TABLE public.guardian_analyses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, month date NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')), recommendation text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.guardian_analyses TO authenticated;
GRANT ALL ON public.guardian_analyses TO service_role;
ALTER TABLE public.guardian_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY guardian_read_own ON public.guardian_analyses FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX guardian_user_month ON public.guardian_analyses(user_id, month);
CREATE TABLE public.guardian_gateway_state (setting_key text PRIMARY KEY, blocked boolean NOT NULL DEFAULT false, message text);
GRANT ALL ON public.guardian_gateway_state TO service_role;
ALTER TABLE public.guardian_gateway_state ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.reserve_guardian_analysis(p_user_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_limit integer; v_enabled boolean; v_month date := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
SELECT enabled, monthly_insight_limit INTO v_enabled, v_limit FROM public.guardian_settings WHERE setting_key='global';
IF NOT coalesce(v_enabled,false) THEN RAISE EXCEPTION 'Guardião indisponível no momento.'; END IF;
IF EXISTS (SELECT 1 FROM public.guardian_gateway_state WHERE blocked) THEN RAISE EXCEPTION 'Guardião temporariamente indisponível.'; END IF;
IF EXISTS (SELECT 1 FROM public.guardian_analyses WHERE user_id=p_user_id AND status='pending' AND created_at > now()-interval '10 minutes') THEN RAISE EXCEPTION 'Uma análise já está em andamento.'; END IF;
IF (SELECT count(*) FROM public.guardian_analyses WHERE user_id=p_user_id AND month=v_month) >= v_limit THEN RAISE EXCEPTION 'Limite mensal de análises atingido.'; END IF;
INSERT INTO public.guardian_analyses(user_id,month) VALUES(p_user_id,v_month) RETURNING id INTO v_id;
RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.reserve_guardian_analysis(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_guardian_analysis(uuid) TO service_role;