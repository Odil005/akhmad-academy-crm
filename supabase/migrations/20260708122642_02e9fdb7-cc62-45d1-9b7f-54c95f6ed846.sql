GRANT SELECT ON public.settings TO anon;
CREATE POLICY "settings: public read contact_info" ON public.settings FOR SELECT TO anon USING (key = 'contact_info');