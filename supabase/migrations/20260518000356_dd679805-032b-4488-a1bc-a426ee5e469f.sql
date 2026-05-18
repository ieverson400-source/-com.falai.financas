CREATE TABLE public.pluggy_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id UUID NOT NULL,
  pluggy_item_id TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  accounts_count INTEGER,
  triggered_by TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_pluggy_sync_logs_item ON public.pluggy_sync_logs(item_id, created_at DESC);
CREATE INDEX idx_pluggy_sync_logs_user ON public.pluggy_sync_logs(user_id, created_at DESC);

ALTER TABLE public.pluggy_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own select" ON public.pluggy_sync_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.pluggy_sync_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.pluggy_sync_logs FOR DELETE USING (auth.uid() = user_id);