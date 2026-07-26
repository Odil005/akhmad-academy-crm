CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.teacher_teaches_student(_teacher_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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

REVOKE ALL ON FUNCTION private.teacher_teaches_student(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.teacher_teaches_student(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Teacher inserts own reply" ON public.parent_teacher_messages;
CREATE POLICY "Teacher inserts own reply" ON public.parent_teacher_messages
FOR INSERT TO authenticated
WITH CHECK ((sender_role = 'teacher'::text) AND (teacher_id = auth.uid()) AND private.teacher_teaches_student(auth.uid(), student_id));

DROP POLICY IF EXISTS "Teacher reads own messages" ON public.parent_teacher_messages;
CREATE POLICY "Teacher reads own messages" ON public.parent_teacher_messages
FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'teacher'::public.app_role) AND ((teacher_id = auth.uid()) OR private.teacher_teaches_student(auth.uid(), student_id)));

DROP POLICY IF EXISTS "Teacher manages own grades" ON public.grades;
CREATE POLICY "Teacher manages own grades" ON public.grades
FOR ALL TO authenticated
USING ((teacher_user_id = auth.uid()) AND private.teacher_teaches_student(auth.uid(), student_id))
WITH CHECK ((teacher_user_id = auth.uid()) AND private.teacher_teaches_student(auth.uid(), student_id));

DROP POLICY IF EXISTS "Profiles: teacher read own students" ON public.profiles;
CREATE POLICY "Profiles: teacher read own students" ON public.profiles
FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'teacher'::public.app_role) AND (EXISTS (
  SELECT 1 FROM public.students s
  WHERE s.profile_id = profiles.id AND private.teacher_teaches_student(auth.uid(), s.id))));

DROP POLICY IF EXISTS "be: staff manage" ON public.behavior_evaluations;
CREATE POLICY "be: staff manage" ON public.behavior_evaluations
FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'director'::public.app_role) OR private.has_role(auth.uid(), 'admin'::public.app_role) OR ((teacher_id = auth.uid()) AND private.teacher_teaches_student(auth.uid(), student_id)))
WITH CHECK (private.has_role(auth.uid(), 'director'::public.app_role) OR private.has_role(auth.uid(), 'admin'::public.app_role) OR ((teacher_id = auth.uid()) AND private.teacher_teaches_student(auth.uid(), student_id)));

DROP POLICY IF EXISTS "be: teacher insert" ON public.behavior_evaluations;
CREATE POLICY "be: teacher insert" ON public.behavior_evaluations
FOR INSERT TO authenticated
WITH CHECK ((teacher_id = auth.uid()) AND private.has_role(auth.uid(), 'teacher'::public.app_role) AND private.teacher_teaches_student(auth.uid(), student_id));

DROP FUNCTION IF EXISTS public.teacher_teaches_student(uuid, uuid);