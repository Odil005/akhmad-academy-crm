ALTER TABLE public.centers ADD COLUMN IF NOT EXISTS is_flagship boolean NOT NULL DEFAULT false;
UPDATE public.centers SET is_flagship = true, status = 'active' WHERE id = '84596da8-b5db-42ba-8908-8fcbeb450928';
UPDATE public.center_subscriptions SET status = 'active', monthly_price = 0, current_period_end = '2099-12-31' WHERE center_id = '84596da8-b5db-42ba-8908-8fcbeb450928';
COMMENT ON COLUMN public.centers.is_flagship IS 'Platform-owned center: never billed, limited or suspended.';