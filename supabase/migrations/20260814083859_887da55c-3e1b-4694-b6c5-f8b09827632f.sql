-- Teachers: full access to lessons they own or whose group they lead
DROP POLICY IF EXISTS lessons_read_teacher_own ON public.lessons;
CREATE POLICY lessons_teacher_manage ON public.lessons FOR ALL TO authenticated
USING (
  private.has_role(auth.uid(), 'teacher'::public.app_role) AND (
    teacher_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = lessons.group_id AND g.teacher_id = auth.uid())
  )
)
WITH CHECK (
  private.has_role(auth.uid(), 'teacher'::public.app_role) AND (
    teacher_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = lessons.group_id AND g.teacher_id = auth.uid())
  )
);

-- Teachers: read all lessons (needed for the shared weekly schedule view)
CREATE POLICY lessons_read_teacher_all ON public.lessons FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'teacher'::public.app_role));

-- Teachers: update their own students' info (schedule/time, parent phone, etc.)
CREATE POLICY students_teacher_update ON public.students FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'teacher'::public.app_role) AND private.teacher_teaches_student(auth.uid(), id))
WITH CHECK (private.has_role(auth.uid(), 'teacher'::public.app_role) AND private.teacher_teaches_student(auth.uid(), id));

-- Teachers: see other teachers' names (schedule columns, filters)
CREATE POLICY profiles_teacher_read_staff ON public.profiles FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'teacher'::public.app_role)
  AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = profiles.id AND ur.role = 'teacher'::public.app_role)
);

-- Teachers: read the teacher roster
CREATE POLICY roles_teacher_read_teachers ON public.user_roles FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'teacher'::public.app_role) AND role = 'teacher'::public.app_role);

-- Teachers: attendance for lessons in groups they lead (in addition to own lessons)
CREATE POLICY att_teacher_group_rw ON public.attendance FOR ALL TO authenticated
USING (
  private.has_role(auth.uid(), 'teacher'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.lessons l JOIN public.groups g ON g.id = l.group_id
    WHERE l.id = attendance.lesson_id AND g.teacher_id = auth.uid()
  )
)
WITH CHECK (
  private.has_role(auth.uid(), 'teacher'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.lessons l JOIN public.groups g ON g.id = l.group_id
    WHERE l.id = attendance.lesson_id AND g.teacher_id = auth.uid()
  )
);

-- Teachers: read payments of their own students (Jarvis / student 360)
CREATE POLICY payments_teacher_read ON public.payments FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'teacher'::public.app_role) AND private.teacher_teaches_student(auth.uid(), student_id));

-- Teachers: manage their own groups (schedule text, fee)
CREATE POLICY groups_teacher_update ON public.groups FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'teacher'::public.app_role) AND teacher_id = auth.uid())
WITH CHECK (private.has_role(auth.uid(), 'teacher'::public.app_role) AND teacher_id = auth.uid());