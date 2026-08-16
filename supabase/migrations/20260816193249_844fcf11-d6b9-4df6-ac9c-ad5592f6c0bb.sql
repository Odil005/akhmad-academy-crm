DROP POLICY IF EXISTS lessons_read_teacher_all ON public.lessons;
CREATE POLICY lessons_read_teacher_own ON public.lessons FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'teacher'::app_role) AND (
    teacher_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = lessons.group_id AND g.teacher_id = auth.uid())
  )
);

DROP POLICY IF EXISTS profiles_teacher_read_staff ON public.profiles;