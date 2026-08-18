-- Helper: which groups a signed-in student belongs to
CREATE OR REPLACE FUNCTION private.student_group_ids(_user_id uuid)
RETURNS TABLE(group_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.group_id FROM public.students s
   WHERE s.profile_id = _user_id AND s.group_id IS NOT NULL
  UNION
  SELECT e.group_id FROM public.student_enrollments e
    JOIN public.students s2 ON s2.id = e.student_id
   WHERE s2.profile_id = _user_id AND e.group_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION private.student_ids_for_user(_user_id uuid)
RETURNS TABLE(student_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id FROM public.students s WHERE s.profile_id = _user_id;
$$;

REVOKE ALL ON FUNCTION private.student_group_ids(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.student_ids_for_user(uuid) FROM PUBLIC;

-- 1. Video lessons
CREATE TABLE IF NOT EXISTS public.video_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  storage_path text NOT NULL,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS video_lessons_group_idx ON public.video_lessons(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_lessons_teacher_idx ON public.video_lessons(teacher_user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_lessons TO authenticated;
GRANT ALL ON public.video_lessons TO service_role;
ALTER TABLE public.video_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY video_lessons_staff_all ON public.video_lessons FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director'));
CREATE POLICY video_lessons_teacher_own ON public.video_lessons FOR ALL TO authenticated
  USING (teacher_user_id = auth.uid())
  WITH CHECK (teacher_user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.teacher_id = auth.uid()));
CREATE POLICY video_lessons_student_read ON public.video_lessons FOR SELECT TO authenticated
  USING (published AND group_id IN (SELECT group_id FROM private.student_group_ids(auth.uid())));

CREATE TRIGGER trg_video_lessons_updated BEFORE UPDATE ON public.video_lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Subject-based intellectual game
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  subject_name text NOT NULL,
  question text NOT NULL,
  options text[] NOT NULL,
  correct_index integer NOT NULL DEFAULT 0,
  explanation text,
  level integer NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quiz_questions_subject_idx ON public.quiz_questions(subject_id, level);
GRANT SELECT ON public.quiz_questions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY quiz_questions_read ON public.quiz_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY quiz_questions_staff_write ON public.quiz_questions FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director') OR private.has_role(auth.uid(), 'teacher'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director') OR private.has_role(auth.uid(), 'teacher'));

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  subject_name text,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 0,
  played_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quiz_attempts_student_idx ON public.quiz_attempts(student_id, played_at DESC);
GRANT SELECT, INSERT ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY quiz_attempts_staff_read ON public.quiz_attempts FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director')
         OR private.teacher_teaches_student(auth.uid(), student_id));
CREATE POLICY quiz_attempts_student_read ON public.quiz_attempts FOR SELECT TO authenticated
  USING (student_id IN (SELECT student_id FROM private.student_ids_for_user(auth.uid())));
CREATE POLICY quiz_attempts_student_insert ON public.quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (student_id IN (SELECT student_id FROM private.student_ids_for_user(auth.uid())));

-- 3. Goal roadmap
CREATE TABLE IF NOT EXISTS public.student_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  target_date date,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS student_goals_student_idx ON public.student_goals(student_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_goals TO authenticated;
GRANT ALL ON public.student_goals TO service_role;
ALTER TABLE public.student_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_goals_staff_all ON public.student_goals FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director')
         OR private.teacher_teaches_student(auth.uid(), student_id))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director')
         OR private.teacher_teaches_student(auth.uid(), student_id));
CREATE POLICY student_goals_student_read ON public.student_goals FOR SELECT TO authenticated
  USING (student_id IN (SELECT student_id FROM private.student_ids_for_user(auth.uid())));

CREATE TABLE IF NOT EXISTS public.student_goal_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.student_goals(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS student_goal_steps_goal_idx ON public.student_goal_steps(goal_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_goal_steps TO authenticated;
GRANT ALL ON public.student_goal_steps TO service_role;
ALTER TABLE public.student_goal_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_goal_steps_staff_all ON public.student_goal_steps FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_goals g WHERE g.id = goal_id
          AND (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director')
               OR private.teacher_teaches_student(auth.uid(), g.student_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.student_goals g WHERE g.id = goal_id
          AND (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director')
               OR private.teacher_teaches_student(auth.uid(), g.student_id))));
CREATE POLICY student_goal_steps_student_rw ON public.student_goal_steps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_goals g WHERE g.id = goal_id
          AND g.student_id IN (SELECT student_id FROM private.student_ids_for_user(auth.uid()))));
CREATE POLICY student_goal_steps_student_update ON public.student_goal_steps FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_goals g WHERE g.id = goal_id
          AND g.student_id IN (SELECT student_id FROM private.student_ids_for_user(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.student_goals g WHERE g.id = goal_id
          AND g.student_id IN (SELECT student_id FROM private.student_ids_for_user(auth.uid()))));

CREATE TRIGGER trg_student_goals_updated BEFORE UPDATE ON public.student_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();