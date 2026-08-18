DROP POLICY IF EXISTS "settings: public read flagged" ON public.settings;
CREATE POLICY "settings: public read flagged" ON public.settings
FOR SELECT TO anon, authenticated
USING (is_public = true AND key = ANY (ARRAY['contact_info','design','homepage_sections','homepage_courses','banners','news','marketplace','grade_template','reports','stats','subjects','teachers','donation']));

ALTER TABLE public.settings DISABLE TRIGGER settings_guard_is_public_trg;

INSERT INTO public.settings (key, value, scope, is_public)
VALUES ('donation', '{"enabled": true, "title": "Loyihani qo''llab-quvvatlash", "message": "Akhmad Academy tizimini rivojlantirishga hissa qo''shishingiz mumkin. Har qanday yordam biz uchun qadrli.", "owner_name": "", "cards": [], "links": []}'::jsonb, 'director', true)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.settings ENABLE TRIGGER settings_guard_is_public_trg;