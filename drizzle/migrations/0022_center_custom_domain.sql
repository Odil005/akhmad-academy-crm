ALTER TABLE public.centers ADD COLUMN IF NOT EXISTS custom_domain text;
CREATE UNIQUE INDEX IF NOT EXISTS centers_custom_domain_key ON public.centers(lower(custom_domain)) WHERE custom_domain IS NOT NULL;
UPDATE public.centers SET custom_domain = 'akhmadacademy.life' WHERE is_flagship AND custom_domain IS NULL;