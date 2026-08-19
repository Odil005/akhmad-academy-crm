-- Markaz aniqlash: foydalanuvchi bog'lanmagan bo'lsa va tizimda bitta markaz bo'lsa — shu markaz
CREATE OR REPLACE FUNCTION private.current_center(_user_id uuid DEFAULT auth.uid())
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT center_id FROM public.user_centers WHERE user_id = _user_id ORDER BY created_at LIMIT 1),
    (SELECT c.id FROM public.centers c WHERE (SELECT count(*) FROM public.centers) = 1 LIMIT 1)
  );
$$;
REVOKE ALL ON FUNCTION private.current_center(uuid) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_center_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.center_id IS NULL THEN
    NEW.center_id := COALESCE(private.current_center(),
      (SELECT id FROM public.centers ORDER BY created_at LIMIT 1));
  END IF;
  RETURN NEW;
END; $$;

DO $$
DECLARE
  t text;
  default_center uuid := (SELECT id FROM public.centers ORDER BY created_at LIMIT 1);
  tables text[] := ARRAY[
    'students','groups','lessons','attendance','grades','behavior_evaluations',
    'payments','expenses','transactions','leads','cash_accounts','cash_shifts',
    'rooms','subjects','video_lessons','student_enrollments','methodology_resources',
    'marketplace_products','marketplace_orders','payment_receipts','teacher_balance',
    'guide_videos','quiz_questions','student_goals'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS center_id uuid REFERENCES public.centers(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE public.%I SET center_id = $1 WHERE center_id IS NULL', t) USING default_center;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (center_id)', 'idx_' || t || '_center', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_set_center ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_set_center BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_center_id()', t, t);
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
        USING (center_id IS NULL OR center_id = private.current_center() OR private.is_platform_owner())
        WITH CHECK (center_id IS NULL OR center_id = private.current_center() OR private.is_platform_owner())
    $p$, t || '_center_isolation', t);
  END LOOP;
END $$;