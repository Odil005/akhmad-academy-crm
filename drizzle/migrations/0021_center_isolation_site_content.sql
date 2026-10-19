CREATE OR REPLACE FUNCTION private.flagship_center() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.centers WHERE is_flagship ORDER BY created_at LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION private.flagship_center() TO anon, authenticated;

DO $$
DECLARE t text; flagship uuid;
BEGIN
  SELECT id INTO flagship FROM public.centers WHERE is_flagship ORDER BY created_at LIMIT 1;
  FOREACH t IN ARRAY ARRAY['design_settings','news','banners','homepage_sections','homepage_courses'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS center_id uuid REFERENCES public.centers(id)', t);
    EXECUTE format('UPDATE public.%I SET center_id = $1 WHERE center_id IS NULL', t) USING flagship;
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_center_id()', 'trg_' || t || '_set_center', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (center_id IS NULL OR center_id = private.current_center() OR private.is_platform_owner()) WITH CHECK (center_id IS NULL OR center_id = private.current_center() OR private.is_platform_owner())', t || '_center_isolation', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO anon USING (center_id IS NULL OR center_id = private.flagship_center())', t || '_public_flagship', t);
  END LOOP;
END $$;

ALTER TABLE public.homepage_sections DROP CONSTRAINT IF EXISTS homepage_sections_section_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS homepage_sections_center_key_idx ON public.homepage_sections(center_id, section_key);