-- Tabela para registrar números do WhatsApp que chegaram via webhook mas não estão vinculados a nenhum perfil
CREATE TABLE public.whatsapp_unmapped_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_phone TEXT NOT NULL UNIQUE,
  last_message_sid TEXT,
  last_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  hits INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_unmapped_numbers ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ver os números não mapeados (apenas metadados de telefone, sem PII)
CREATE POLICY "Authenticated can view unmapped numbers"
ON public.whatsapp_unmapped_numbers
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX idx_whatsapp_unmapped_last_seen ON public.whatsapp_unmapped_numbers (last_seen_at DESC);