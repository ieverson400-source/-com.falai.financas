CREATE TABLE public.shop_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL DEFAULT 'offer' CHECK (kind IN ('highlight','offer','coupon')),
  brand text,
  title text NOT NULL,
  subtitle text,
  price text,
  installments text,
  cashback text,
  badges text[] NOT NULL DEFAULT '{}',
  cta_label text,
  link_url text,
  image_url text,
  accent text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shop_offers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_offers TO authenticated;
GRANT ALL ON public.shop_offers TO service_role;

ALTER TABLE public.shop_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view live offers"
ON public.shop_offers FOR SELECT
TO anon, authenticated
USING (
  is_active
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at >= now())
);

CREATE POLICY "Admins can view all offers"
ON public.shop_offers FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert offers"
ON public.shop_offers FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update offers"
ON public.shop_offers FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete offers"
ON public.shop_offers FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_shop_offers_updated_at
BEFORE UPDATE ON public.shop_offers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX shop_offers_kind_order_idx ON public.shop_offers (kind, sort_order);

CREATE POLICY "Admins can view webhook events"
ON public.pluggy_webhook_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.shop_offers (kind, brand, title, subtitle, price, installments, cashback, badges, cta_label, link_url, accent, sort_order) VALUES
('highlight','Falaí Shop','iPhone 16 em 21x sem juros','Feito para Apple Intelligence',NULL,NULL,NULL,ARRAY['21x sem juros','Frete grátis','5G'],'Comprar agora','https://falai-finan-as.lovable.app/app/shop','from-primary/20 to-primary/5',1),
('highlight','Falaí Shop','Gift Cards com desconto','Economize nas suas marcas favoritas comprando créditos',NULL,NULL,NULL,ARRAY['Até 15% off','Entrega imediata'],'Comprar com desconto','https://falai-finan-as.lovable.app/app/shop','from-accent/25 to-accent/5',2),
('offer','Netshoes','Tênis e artigos esportivos',NULL,NULL,NULL,'Até 12%',ARRAY[]::text[],'Ver oferta','https://www.netshoes.com.br',NULL,1),
('offer','Nike','Tênis Air Force 1 ''07',NULL,'R$ 599,99','ou 10x de R$ 59,99','Até R$ 12,00',ARRAY[]::text[],'Ver oferta','https://www.nike.com.br',NULL,2),
('coupon','Falaí Shop','Ar condicionado com frete grátis',NULL,NULL,NULL,'R$ 100,00 de cashback',ARRAY[]::text[],NULL,NULL,NULL,1);