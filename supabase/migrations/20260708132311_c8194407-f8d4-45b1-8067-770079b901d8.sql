
INSERT INTO public.settings (key, scope, value)
VALUES ('homepage_stats', 'shared', '{"students":"1200+","courses":"50+","teachers":"35+","satisfaction":"98%"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE POLICY "settings: public read homepage_stats"
  ON public.settings FOR SELECT TO anon
  USING (key = 'homepage_stats');
