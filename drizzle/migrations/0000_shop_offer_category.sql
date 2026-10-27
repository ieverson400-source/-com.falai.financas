ALTER TABLE public.shop_offers ADD COLUMN IF NOT EXISTS category text;
COMMENT ON COLUMN public.shop_offers.category IS 'Optional offer category; legacy offers remain uncategorized.';