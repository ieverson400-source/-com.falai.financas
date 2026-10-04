CREATE TABLE public.advertisers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL,
  logo_url text,
  website_url text,
  description text,
  contact_email text,
  contact_phone text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paused','rejected')),
  owner_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advertisers TO authenticated;
GRANT ALL ON public.advertisers TO service_role;
ALTER TABLE public.advertisers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage advertisers" ON public.advertisers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners view their advertiser" ON public.advertisers FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "Owners update their advertiser" ON public.advertisers FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE TRIGGER update_advertisers_updated_at BEFORE UPDATE ON public.advertisers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX advertisers_status_idx ON public.advertisers(status);
CREATE INDEX advertisers_owner_idx ON public.advertisers(owner_user_id) WHERE owner_user_id IS NOT NULL;

CREATE TABLE public.advertisements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advertiser_id uuid NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  image_url text,
  logo_url text,
  destination_url text NOT NULL,
  category text,
  offer_text text,
  badge_text text,
  placement text NOT NULL DEFAULT 'SHOP_OFFERS' CHECK (placement IN ('SHOP_TOP','SHOP_MIDDLE','SHOP_OFFERS','SHOP_BOTTOM')),
  start_date timestamptz,
  end_date timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','active','paused','expired','rejected')),
  is_sponsored boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0 CHECK (priority >= 0),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  contracted_revenue numeric(12,2) NOT NULL DEFAULT 0 CHECK (contracted_revenue >= 0),
  billing_provider text,
  billing_reference text,
  billing_status text NOT NULL DEFAULT 'not_required' CHECK (billing_status IN ('not_required','pending','paid','failed','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.advertisements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advertisements TO authenticated;
GRANT ALL ON public.advertisements TO service_role;
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views live advertisements" ON public.advertisements FOR SELECT TO anon, authenticated USING (status = 'active' AND (start_date IS NULL OR start_date <= now()) AND (end_date IS NULL OR end_date >= now()));
CREATE POLICY "Admins view all advertisements" ON public.advertisements FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert advertisements" ON public.advertisements FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update advertisements" ON public.advertisements FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete advertisements" ON public.advertisements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Advertisers view own advertisements" ON public.advertisements FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.advertisers a WHERE a.id = advertiser_id AND a.owner_user_id = auth.uid()));
CREATE POLICY "Advertisers update own advertisements" ON public.advertisements FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.advertisers a WHERE a.id = advertiser_id AND a.owner_user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.advertisers a WHERE a.id = advertiser_id AND a.owner_user_id = auth.uid()) AND status IN ('draft','pending','paused'));
CREATE TRIGGER update_advertisements_updated_at BEFORE UPDATE ON public.advertisements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX advertisements_live_idx ON public.advertisements(placement, status, priority DESC, sort_order, start_date, end_date);
CREATE INDEX advertisements_advertiser_idx ON public.advertisements(advertiser_id);

CREATE TABLE public.advertisement_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advertisement_id uuid NOT NULL REFERENCES public.advertisements(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('impression','click')),
  user_id uuid,
  session_id uuid NOT NULL,
  event_day date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(advertisement_id, event_type, session_id, event_day)
);
GRANT SELECT, INSERT ON public.advertisement_events TO authenticated;
GRANT ALL ON public.advertisement_events TO service_role;
ALTER TABLE public.advertisement_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users register advertisement events" ON public.advertisement_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.advertisements ad WHERE ad.id = advertisement_id AND ad.status = 'active' AND (ad.start_date IS NULL OR ad.start_date <= now()) AND (ad.end_date IS NULL OR ad.end_date >= now())));
CREATE POLICY "Users view own advertisement events" ON public.advertisement_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all advertisement events" ON public.advertisement_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX advertisement_events_metrics_idx ON public.advertisement_events(advertisement_id, event_type, created_at);

CREATE TABLE public.adsense_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL DEFAULT 'shop' UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  publisher_id text,
  ad_slot_id text,
  ad_format text NOT NULL DEFAULT 'auto' CHECK (ad_format IN ('auto','horizontal','rectangle','vertical','fluid')),
  position text NOT NULL DEFAULT 'SHOP_MIDDLE' CHECK (position IN ('SHOP_TOP','SHOP_MIDDLE','SHOP_OFFERS','SHOP_BOTTOM')),
  max_width integer NOT NULL DEFAULT 970 CHECK (max_width BETWEEN 280 AND 1600),
  margin_top integer NOT NULL DEFAULT 16 CHECK (margin_top BETWEEN 0 AND 160),
  margin_bottom integer NOT NULL DEFAULT 24 CHECK (margin_bottom BETWEEN 0 AND 160),
  show_in_shop boolean NOT NULL DEFAULT true,
  show_in_other_screens boolean NOT NULL DEFAULT false,
  test_mode boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.adsense_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adsense_settings TO authenticated;
GRANT ALL ON public.adsense_settings TO service_role;
ALTER TABLE public.adsense_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads enabled AdSense settings" ON public.adsense_settings FOR SELECT TO anon, authenticated USING (enabled AND show_in_shop);
CREATE POLICY "Admins view all AdSense settings" ON public.adsense_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert AdSense settings" ON public.adsense_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update AdSense settings" ON public.adsense_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete AdSense settings" ON public.adsense_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_adsense_settings_updated_at BEFORE UPDATE ON public.adsense_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.advertisement_placement_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  placement text NOT NULL UNIQUE CHECK (placement IN ('SHOP_TOP','SHOP_MIDDLE','SHOP_OFFERS','SHOP_BOTTOM')),
  max_ads integer NOT NULL DEFAULT 6 CHECK (max_ads BETWEEN 1 AND 30),
  is_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.advertisement_placement_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advertisement_placement_settings TO authenticated;
GRANT ALL ON public.advertisement_placement_settings TO service_role;
ALTER TABLE public.advertisement_placement_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads enabled placement settings" ON public.advertisement_placement_settings FOR SELECT TO anon, authenticated USING (is_enabled);
CREATE POLICY "Admins view all placement settings" ON public.advertisement_placement_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert placement settings" ON public.advertisement_placement_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update placement settings" ON public.advertisement_placement_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete placement settings" ON public.advertisement_placement_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_advertisement_placement_settings_updated_at BEFORE UPDATE ON public.advertisement_placement_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.advertisement_placement_settings (placement, max_ads) VALUES
('SHOP_TOP', 1), ('SHOP_MIDDLE', 1), ('SHOP_OFFERS', 6), ('SHOP_BOTTOM', 2);
INSERT INTO public.adsense_settings (setting_key, enabled, show_in_shop, test_mode) VALUES ('shop', false, true, true);