ALTER TABLE public.settings DISABLE TRIGGER USER;
INSERT INTO public.settings (key, scope, is_public, value)
VALUES ('site_location', 'shared', true, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;
ALTER TABLE public.settings ENABLE TRIGGER USER;