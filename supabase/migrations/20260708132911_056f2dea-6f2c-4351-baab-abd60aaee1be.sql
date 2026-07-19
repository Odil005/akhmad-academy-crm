
-- 1) teacher_ui_settings: restrict read to authenticated users
DROP POLICY IF EXISTS "tus: read all" ON public.teacher_ui_settings;
CREATE POLICY "tus: authenticated read"
  ON public.teacher_ui_settings FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.teacher_ui_settings FROM anon;

-- 2) lessons: scope reads by role
DROP POLICY IF EXISTS "lessons_read_auth" ON public.lessons;

CREATE POLICY "lessons_read_staff"
  ON public.lessons FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "lessons_read_teacher_own"
  ON public.lessons FOR SELECT
  TO authenticated
  USING (teacher_user_id = auth.uid());

CREATE POLICY "lessons_read_student_group"
  ON public.lessons FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.profile_id = auth.uid()
        AND s.group_id = lessons.group_id
    )
  );

REVOKE SELECT ON public.lessons FROM anon;
