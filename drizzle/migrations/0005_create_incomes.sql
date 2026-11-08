CREATE TABLE public.incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  description text,
  income_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX incomes_user_date_idx ON public.incomes (user_id, income_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incomes TO authenticated;
GRANT ALL ON public.incomes TO service_role;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own incomes" ON public.incomes FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.is_account_active(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_account_active(auth.uid()));
CREATE POLICY "Admins read incomes" ON public.incomes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));