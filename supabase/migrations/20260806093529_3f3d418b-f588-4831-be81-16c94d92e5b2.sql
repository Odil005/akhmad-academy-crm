
-- design_settings
DROP POLICY IF EXISTS "design: public read active" ON public.design_settings;
CREATE POLICY "design: anon read active" ON public.design_settings FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "design: auth read" ON public.design_settings FOR SELECT TO authenticated
USING (is_active = true OR private.has_role(auth.uid(),'director'::app_role) OR private.has_role(auth.uid(),'admin'::app_role));

-- homepage_sections
DROP POLICY IF EXISTS "hs: public read visible" ON public.homepage_sections;
CREATE POLICY "hs: anon read visible" ON public.homepage_sections FOR SELECT TO anon USING (is_visible = true);
CREATE POLICY "hs: auth read" ON public.homepage_sections FOR SELECT TO authenticated
USING (is_visible = true OR private.has_role(auth.uid(),'director'::app_role) OR private.has_role(auth.uid(),'admin'::app_role));

-- banners
DROP POLICY IF EXISTS "banners: read active" ON public.banners;
CREATE POLICY "banners: anon read active" ON public.banners FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "banners: auth read" ON public.banners FOR SELECT TO authenticated
USING (is_active = true OR private.has_role(auth.uid(),'director'::app_role) OR private.has_role(auth.uid(),'admin'::app_role));

-- news
DROP POLICY IF EXISTS "news: read published" ON public.news;
CREATE POLICY "news: anon read published" ON public.news FOR SELECT TO anon USING (is_published = true);
CREATE POLICY "news: auth read" ON public.news FOR SELECT TO authenticated
USING (is_published = true OR private.has_role(auth.uid(),'director'::app_role) OR private.has_role(auth.uid(),'admin'::app_role));

-- settings public read: restrict to anon + authenticated explicitly (flag-gated, no role fallback)
DROP POLICY IF EXISTS "settings: public read flagged" ON public.settings;
CREATE POLICY "settings: public read flagged" ON public.settings FOR SELECT TO anon, authenticated
USING (is_public = true AND key = ANY (ARRAY['contact_info','design','homepage_sections','homepage_courses','banners','news','marketplace','grade_template','reports','stats','subjects','teachers']));

-- leads: staff-only, authenticated role
DROP POLICY IF EXISTS "staff can read leads" ON public.leads;
DROP POLICY IF EXISTS "staff can update leads" ON public.leads;
DROP POLICY IF EXISTS "staff can delete leads" ON public.leads;
CREATE POLICY "staff can read leads" ON public.leads FOR SELECT TO authenticated
USING (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'director'::app_role));
CREATE POLICY "staff can update leads" ON public.leads FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'director'::app_role))
WITH CHECK (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'director'::app_role));
CREATE POLICY "staff can delete leads" ON public.leads FOR DELETE TO authenticated
USING (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'director'::app_role));
