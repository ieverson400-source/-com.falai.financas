ALTER TABLE public.shop_offers
ADD COLUMN card_size text NOT NULL DEFAULT 'md'
CHECK (card_size IN ('sm','md','lg','full'));