
CREATE TABLE public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  teacher_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  score NUMERIC(5,2) NOT NULL,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 100,
  kind TEXT NOT NULL DEFAULT 'lesson' CHECK (kind IN ('lesson','homework','quiz','exam')),
  comment TEXT,
  graded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grades TO authenticated;
GRANT ALL ON public.grades TO service_role;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage grades" ON public.grades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Teacher manages own grades" ON public.grades FOR ALL TO authenticated
  USING (teacher_user_id = auth.uid())
  WITH CHECK (teacher_user_id = auth.uid());

CREATE POLICY "Student views own grades" ON public.grades FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = grades.student_id AND s.profile_id = auth.uid()));

CREATE TRIGGER trg_grades_updated BEFORE UPDATE ON public.grades FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_grades_student ON public.grades (student_id, graded_at DESC);
CREATE INDEX idx_grades_teacher ON public.grades (teacher_user_id, graded_at DESC);
