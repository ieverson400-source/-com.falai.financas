CREATE TABLE public.guardian_settings (
  setting_key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  system_prompt TEXT NOT NULL DEFAULT 'Você é o Guardião Financeiro do Falaí Finanças. Analise apenas os totais por categoria enviados e gere um resumo curto em português brasileiro com até 3 recomendações práticas de economia. Nunca peça, mencione ou invente senhas, tokens, saldos completos ou dados bancários. Seja direto e amigável.',
  monthly_insight_limit INTEGER NOT NULL DEFAULT 30,
  share_category_totals_only BOOLEAN NOT NULL DEFAULT true,
  include_budget_alerts BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.guardian_settings TO authenticated;
GRANT ALL ON public.guardian_settings TO service_role;
ALTER TABLE public.guardian_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read guardian settings" ON public.guardian_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert guardian settings" ON public.guardian_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update guardian settings" ON public.guardian_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.guardian_settings (setting_key) VALUES ('global');