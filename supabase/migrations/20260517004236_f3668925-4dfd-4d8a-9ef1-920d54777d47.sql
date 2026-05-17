
CREATE TABLE public.pluggy_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pluggy_item_id text NOT NULL UNIQUE,
  connector_id integer,
  institution_name text,
  status text NOT NULL DEFAULT 'UPDATING',
  status_detail jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pluggy_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.pluggy_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.pluggy_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.pluggy_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.pluggy_items FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_pluggy_items_user ON public.pluggy_items(user_id);

CREATE TABLE public.pluggy_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.pluggy_items(id) ON DELETE CASCADE,
  pluggy_account_id text NOT NULL UNIQUE,
  type text,
  subtype text,
  name text,
  number text,
  balance numeric(18,2),
  currency_code text DEFAULT 'BRL',
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pluggy_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.pluggy_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.pluggy_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.pluggy_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.pluggy_accounts FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_pluggy_accounts_user ON public.pluggy_accounts(user_id);
CREATE INDEX idx_pluggy_accounts_item ON public.pluggy_accounts(item_id);

CREATE TABLE public.pluggy_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.pluggy_accounts(id) ON DELETE CASCADE,
  pluggy_transaction_id text NOT NULL UNIQUE,
  description text,
  amount numeric(18,2) NOT NULL,
  currency_code text DEFAULT 'BRL',
  transaction_date timestamptz NOT NULL,
  category text,
  type text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pluggy_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.pluggy_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.pluggy_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.pluggy_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.pluggy_transactions FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_pluggy_tx_user ON public.pluggy_transactions(user_id);
CREATE INDEX idx_pluggy_tx_account ON public.pluggy_transactions(account_id);
CREATE INDEX idx_pluggy_tx_date ON public.pluggy_transactions(transaction_date DESC);

CREATE TRIGGER trg_pluggy_items_updated BEFORE UPDATE ON public.pluggy_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pluggy_accounts_updated BEFORE UPDATE ON public.pluggy_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
