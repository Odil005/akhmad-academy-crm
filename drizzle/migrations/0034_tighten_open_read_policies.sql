-- plans: only platform owners (existing plans_owner_all) read plans; app reads them server-side.
DROP POLICY IF EXISTS "plans_read" ON public.plans;

-- quiz_questions: only CRM members (staff and students) can read the quiz bank.
DROP POLICY IF EXISTS "quiz_questions_read" ON public.quiz_questions;
CREATE POLICY "quiz_questions_read" ON public.quiz_questions
  FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'director'::public.app_role)
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'teacher'::public.app_role)
    OR private.has_role(auth.uid(), 'student'::public.app_role)
  );

-- subjects: signed-in CRM members only (no anonymous access).
DROP POLICY IF EXISTS "Subjects: all read" ON public.subjects;
CREATE POLICY "Subjects: members read" ON public.subjects
  FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'director'::public.app_role)
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'teacher'::public.app_role)
    OR private.has_role(auth.uid(), 'student'::public.app_role)
  );

-- marketplace_categories: signed-in CRM members only.
DROP POLICY IF EXISTS "mc: read all" ON public.marketplace_categories;
CREATE POLICY "mc: members read" ON public.marketplace_categories
  FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'director'::public.app_role)
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'teacher'::public.app_role)
    OR private.has_role(auth.uid(), 'student'::public.app_role)
  );

-- marketplace_products: members see available products; staff also see hidden ones (staff write policy covers that).
DROP POLICY IF EXISTS "mp: read all" ON public.marketplace_products;
CREATE POLICY "mp: members read available" ON public.marketplace_products
  FOR SELECT TO authenticated
  USING (
    is_available = true
    AND (
      private.has_role(auth.uid(), 'teacher'::public.app_role)
      OR private.has_role(auth.uid(), 'student'::public.app_role)
    )
  );

-- checkin_locations: only staff can read check-in coordinates.
DROP POLICY IF EXISTS "checkin_locations_read" ON public.checkin_locations;
CREATE POLICY "checkin_locations_read" ON public.checkin_locations
  FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'director'::public.app_role)
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'teacher'::public.app_role)
  );

REVOKE SELECT ON public.subjects, public.marketplace_categories, public.marketplace_products FROM anon;