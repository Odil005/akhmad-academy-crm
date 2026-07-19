
-- Bir o'quvchini bir nechta guruh/fanga yozish uchun jadval
CREATE TABLE public.student_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  teacher_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at date NOT NULL DEFAULT CURRENT_DATE,
  ended_at date,
  status text NOT NULL DEFAULT 'active',
  monthly_fee numeric(12,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, group_id)
);

CREATE INDEX idx_enroll_student ON public.student_enrollments(student_id);
CREATE INDEX idx_enroll_group ON public.student_enrollments(group_id);
CREATE INDEX idx_enroll_teacher ON public.student_enrollments(teacher_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_enrollments TO authenticated;
GRANT ALL ON public.student_enrollments TO service_role;

ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;

-- Staff: hamma yozuvni ko'radi va boshqaradi
CREATE POLICY "enroll_staff_all" ON public.student_enrollments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'admin'));

-- Teacher: faqat o'z guruh(lar)idagi yozuvlarni ko'radi
CREATE POLICY "enroll_teacher_read" ON public.student_enrollments
  FOR SELECT TO authenticated
  USING (
    teacher_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.teacher_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.lessons l WHERE l.group_id = student_enrollments.group_id AND l.teacher_user_id = auth.uid())
  );

-- Student: faqat o'zining yozuvlarini
CREATE POLICY "enroll_student_self" ON public.student_enrollments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.profile_id = auth.uid()));

CREATE TRIGGER trg_enroll_updated BEFORE UPDATE ON public.student_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Mavjud students.group_id qiymatlarini yangi jadvalga ko'chirish (backward compat)
INSERT INTO public.student_enrollments (student_id, group_id, subject_id, teacher_user_id, started_at, monthly_fee)
SELECT s.id, s.group_id, g.subject_id, g.teacher_id, s.enrolled_at::date, g.monthly_fee
FROM public.students s
JOIN public.groups g ON g.id = s.group_id
WHERE s.group_id IS NOT NULL
ON CONFLICT (student_id, group_id) DO NOTHING;
