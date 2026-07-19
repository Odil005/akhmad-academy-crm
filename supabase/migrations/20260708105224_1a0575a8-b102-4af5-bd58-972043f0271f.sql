
-- ROOMS
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INT NOT NULL DEFAULT 20,
  floor TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_read_auth" ON public.rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "rooms_write_admin" ON public.rooms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_rooms_updated BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- LESSONS (weekly recurring schedule)
CREATE TABLE public.lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  teacher_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Mon..7=Sun
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lessons_read_auth" ON public.lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "lessons_write_admin" ON public.lessons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));

CREATE INDEX idx_lessons_group ON public.lessons(group_id);
CREATE INDEX idx_lessons_room_day ON public.lessons(room_id, day_of_week);
CREATE INDEX idx_lessons_teacher_day ON public.lessons(teacher_user_id, day_of_week);

CREATE TRIGGER trg_lessons_updated BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ATTENDANCE (per lesson per date per student)
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late','excused')),
  note TEXT,
  marked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, student_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Admin/director: to'liq huquq
CREATE POLICY "att_admin_all" ON public.attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));

-- Teacher: faqat o'z darslari uchun
CREATE POLICY "att_teacher_rw" ON public.attendance FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'teacher') AND EXISTS (
      SELECT 1 FROM public.lessons l WHERE l.id = attendance.lesson_id AND l.teacher_user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(),'teacher') AND EXISTS (
      SELECT 1 FROM public.lessons l WHERE l.id = attendance.lesson_id AND l.teacher_user_id = auth.uid()
    )
  );

-- Student: faqat o'zini o'qiydi
CREATE POLICY "att_student_read_own" ON public.attendance FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = attendance.student_id AND s.profile_id = auth.uid()));

CREATE INDEX idx_attendance_lesson_date ON public.attendance(lesson_id, date);
CREATE INDEX idx_attendance_student_date ON public.attendance(student_id, date);

CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
