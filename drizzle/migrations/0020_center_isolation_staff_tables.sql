DO $$
DECLARE t text; flagship uuid;
BEGIN
  SELECT id INTO flagship FROM public.centers WHERE is_flagship ORDER BY created_at LIMIT 1;
  FOREACH t IN ARRAY ARRAY['staff_salaries','checkin_locations','teacher_checkins','discount_rules','payment_plans','import_batches','director_report_recipients','teacher_salary_payments'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS center_id uuid REFERENCES public.centers(id)', t);
    EXECUTE format('UPDATE public.%I SET center_id = $1 WHERE center_id IS NULL', t) USING flagship;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(center_id)', t || '_center_idx', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_center_id()', 'trg_' || t || '_set_center', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (center_id IS NULL OR center_id = private.current_center() OR private.is_platform_owner()) WITH CHECK (center_id IS NULL OR center_id = private.current_center() OR private.is_platform_owner())', t || '_center_isolation', t);
  END LOOP;
END $$;