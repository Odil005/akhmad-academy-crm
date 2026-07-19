
-- 1) design_settings: restrict public reads to active rows; staff sees all
DROP POLICY IF EXISTS "design: read all" ON public.design_settings;
CREATE POLICY "design: public read active" ON public.design_settings
  FOR SELECT USING (
    is_active = true
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 2) homepage_sections: restrict public reads to visible rows; staff sees all
DROP POLICY IF EXISTS "hs: read all" ON public.homepage_sections;
CREATE POLICY "hs: public read visible" ON public.homepage_sections
  FOR SELECT USING (
    is_visible = true
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 3) settings: restrict public read flag to an allow-list of safe keys
DROP POLICY IF EXISTS "settings: public read flagged" ON public.settings;
CREATE POLICY "settings: public read flagged"
  ON public.settings
  FOR SELECT
  USING (
    is_public = true
    AND key IN (
      'contact_info',
      'design',
      'homepage_sections',
      'homepage_courses',
      'banners',
      'news',
      'marketplace',
      'grade_template',
      'reports',
      'stats',
      'subjects',
      'teachers'
    )
  );

-- 4) Lock down SECURITY DEFINER functions.
-- Trigger functions never need direct EXECUTE from API roles.
REVOKE EXECUTE ON FUNCTION public.expense_to_transaction() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.marketplace_order_enforce_price() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.payment_to_transaction() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.settings_guard_is_public() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tx_update_cash_balance() FROM PUBLIC, anon, authenticated;

-- teachers_for_student is only invoked server-side via the service role (Telegram webhook).
REVOKE EXECUTE ON FUNCTION public.teachers_for_student(uuid) FROM PUBLIC, anon, authenticated;

-- has_role and teacher_teaches_student are used inside RLS policies.
-- Revoke from anon; keep authenticated so policies can evaluate them.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.teacher_teaches_student(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
