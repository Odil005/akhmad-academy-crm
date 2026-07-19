
ALTER TABLE public.teacher_balance
  ADD COLUMN IF NOT EXISTS percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_base numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS percent_earning numeric(14,2) NOT NULL DEFAULT 0;

CREATE POLICY "Profiles: teacher read own students"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'teacher'::app_role) AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.profile_id = profiles.id AND public.teacher_teaches_student(auth.uid(), s.id)
    )
  );
