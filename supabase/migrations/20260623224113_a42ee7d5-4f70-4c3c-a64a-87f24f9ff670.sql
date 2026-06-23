ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_expense_confirmation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_monthly_summary boolean NOT NULL DEFAULT true;