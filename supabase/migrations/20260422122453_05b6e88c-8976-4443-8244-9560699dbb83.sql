ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS whatsapp_phone text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_whatsapp_phone_unique_idx
ON public.profiles (whatsapp_phone)
WHERE whatsapp_phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'twilio',
  from_phone text NOT NULL,
  message_sid text NOT NULL,
  media_url text,
  media_content_type text,
  transcript text,
  expense_id uuid,
  processing_status text NOT NULL DEFAULT 'received',
  error_message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_inbox_user_fk FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  CONSTRAINT whatsapp_inbox_expense_fk FOREIGN KEY (expense_id) REFERENCES public.expenses(id) ON DELETE SET NULL,
  CONSTRAINT whatsapp_inbox_processing_status_check CHECK (processing_status IN ('received', 'processing', 'processed', 'ignored', 'failed')),
  CONSTRAINT whatsapp_inbox_message_sid_unique UNIQUE (message_sid)
);

ALTER TABLE public.whatsapp_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own whatsapp inbox"
ON public.whatsapp_inbox
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users update own whatsapp inbox"
ON public.whatsapp_inbox
FOR UPDATE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS whatsapp_inbox_user_created_idx
ON public.whatsapp_inbox (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_inbox_from_phone_idx
ON public.whatsapp_inbox (from_phone);

DROP TRIGGER IF EXISTS update_whatsapp_inbox_updated_at ON public.whatsapp_inbox;
CREATE TRIGGER update_whatsapp_inbox_updated_at
BEFORE UPDATE ON public.whatsapp_inbox
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();