ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS blocked_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.protect_profile_access_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.is_active, NEW.blocked_reason, NEW.blocked_at)
     IS DISTINCT FROM
     (OLD.is_active, OLD.blocked_reason, OLD.blocked_at)
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
  THEN
    RAISE EXCEPTION 'Only administrators can change profile access status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_access_fields ON public.profiles;
CREATE TRIGGER protect_profile_access_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_access_fields();

CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE DEFAULT 'global',
  maintenance_mode boolean NOT NULL DEFAULT false,
  registrations_enabled boolean NOT NULL DEFAULT true,
  automatic_whatsapp_enabled boolean NOT NULL DEFAULT true,
  home_banner_text text,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read public app settings"
ON public.app_settings FOR SELECT TO anon, authenticated
USING (setting_key = 'global');
CREATE POLICY "Admins can insert app settings"
ON public.app_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update app settings"
ON public.app_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete app settings"
ON public.app_settings FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  name text NOT NULL,
  message_type text NOT NULL,
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view WhatsApp templates"
ON public.whatsapp_templates FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert WhatsApp templates"
ON public.whatsapp_templates FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update WhatsApp templates"
ON public.whatsapp_templates FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete WhatsApp templates"
ON public.whatsapp_templates FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  notification_type text NOT NULL,
  provider text NOT NULL DEFAULT 'n8n',
  recipient text,
  status text NOT NULL DEFAULT 'pending',
  message_content text,
  error_message text,
  provider_message_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_logs TO authenticated;
GRANT ALL ON public.notification_logs TO service_role;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view notification logs"
ON public.notification_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert notification logs"
ON public.notification_logs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update notification logs"
ON public.notification_logs FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete notification logs"
ON public.notification_logs FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER update_notification_logs_updated_at
BEFORE UPDATE ON public.notification_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admins can view all WhatsApp inbox messages"
ON public.whatsapp_inbox FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can view all Pluggy transactions"
ON public.pluggy_transactions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX notification_logs_created_at_idx ON public.notification_logs (created_at DESC);
CREATE INDEX notification_logs_status_idx ON public.notification_logs (status);
CREATE INDEX notification_logs_user_id_idx ON public.notification_logs (user_id);
CREATE INDEX profiles_is_active_idx ON public.profiles (is_active);

INSERT INTO public.app_settings (setting_key)
VALUES ('global')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.whatsapp_templates (template_key, name, message_type, content)
VALUES
  ('welcome', 'Boas-vindas', 'welcome', 'Olá, {{nome}}! Bem-vindo ao Falaí Finanças.'),
  ('daily_summary', 'Resumo diário', 'daily_summary', 'Olá, {{nome}}! Aqui está seu resumo financeiro de hoje: {{resumo}}'),
  ('weekly_summary', 'Resumo semanal', 'weekly_summary', 'Olá, {{nome}}! Aqui está seu resumo financeiro da semana: {{resumo}}')
ON CONFLICT (template_key) DO NOTHING;