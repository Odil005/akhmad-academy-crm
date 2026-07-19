
-- Helper: does teacher teach a given student (via direct group or enrollments)?
CREATE OR REPLACE FUNCTION public.teacher_teaches_student(_teacher_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.groups g ON g.id = s.group_id
    WHERE s.id = _student_id AND g.teacher_id = _teacher_id
  ) OR EXISTS (
    SELECT 1 FROM public.student_enrollments e
    WHERE e.student_id = _student_id
      AND (e.teacher_user_id = _teacher_id
           OR EXISTS (SELECT 1 FROM public.groups g2 WHERE g2.id = e.group_id AND g2.teacher_id = _teacher_id))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.teacher_teaches_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teacher_teaches_student(uuid, uuid) TO authenticated;

-- Tighten behavior_evaluations teacher INSERT policy
DROP POLICY IF EXISTS "be: teacher insert" ON public.behavior_evaluations;
CREATE POLICY "be: teacher insert" ON public.behavior_evaluations
FOR INSERT TO authenticated
WITH CHECK (
  teacher_id = auth.uid()
  AND has_role(auth.uid(), 'teacher'::app_role)
  AND public.teacher_teaches_student(auth.uid(), student_id)
);

-- Tighten behavior_evaluations teacher UPDATE (staff manage) - retain director/admin, restrict teacher
DROP POLICY IF EXISTS "be: staff manage" ON public.behavior_evaluations;
CREATE POLICY "be: staff manage" ON public.behavior_evaluations
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (teacher_id = auth.uid() AND public.teacher_teaches_student(auth.uid(), student_id))
)
WITH CHECK (
  has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (teacher_id = auth.uid() AND public.teacher_teaches_student(auth.uid(), student_id))
);

-- Tighten grades teacher policy: require teacher actually teaches student
DROP POLICY IF EXISTS "Teacher manages own grades" ON public.grades;
CREATE POLICY "Teacher manages own grades" ON public.grades
FOR ALL TO authenticated
USING (
  teacher_user_id = auth.uid()
  AND public.teacher_teaches_student(auth.uid(), student_id)
)
WITH CHECK (
  teacher_user_id = auth.uid()
  AND public.teacher_teaches_student(auth.uid(), student_id)
);

-- Address SECURITY DEFINER exec finding: convert has_role to SECURITY INVOKER is unsafe
-- (would break RLS lookups across users). Instead, keep DEFINER but ensure the function
-- is intentionally callable by authenticated; revoke from anon/public explicitly.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
