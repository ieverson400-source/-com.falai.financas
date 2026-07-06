
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_daily_summary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_weekly_summary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_budget_alert boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_weekly_tip boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_inactivity boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_inactivity_reminder_at timestamptz;

CREATE TABLE public.category_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  monthly_limit numeric(12,2) NOT NULL CHECK (monthly_limit > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_budgets TO authenticated;
GRANT ALL ON public.category_budgets TO service_role;
ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own budgets" ON public.category_budgets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_category_budgets_updated_at
  BEFORE UPDATE ON public.category_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.budget_alerts_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  month date NOT NULL,
  threshold int NOT NULL CHECK (threshold IN (80, 100)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category, month, threshold)
);
GRANT SELECT, INSERT ON public.budget_alerts_sent TO authenticated;
GRANT ALL ON public.budget_alerts_sent TO service_role;
ALTER TABLE public.budget_alerts_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own alerts" ON public.budget_alerts_sent
  FOR SELECT USING (auth.uid() = user_id);
