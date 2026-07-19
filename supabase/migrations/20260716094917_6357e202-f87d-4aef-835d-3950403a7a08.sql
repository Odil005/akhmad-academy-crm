
-- 1) parent_teacher_messages
CREATE TABLE public.parent_teacher_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  parent_chat_id text,
  sender_role text NOT NULL CHECK (sender_role IN ('parent','teacher')),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','delivered','read','error')),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ptm_student ON public.parent_teacher_messages(student_id, created_at DESC);
CREATE INDEX idx_ptm_teacher ON public.parent_teacher_messages(teacher_id, created_at DESC);
CREATE INDEX idx_ptm_unread ON public.parent_teacher_messages(teacher_id) WHERE read_at IS NULL AND sender_role = 'parent';

GRANT SELECT, INSERT, UPDATE ON public.parent_teacher_messages TO authenticated;
GRANT ALL ON public.parent_teacher_messages TO service_role;
ALTER TABLE public.parent_teacher_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read all messages" ON public.parent_teacher_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'director'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teacher reads own messages" ON public.parent_teacher_messages
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher'::app_role)
    AND (teacher_id = auth.uid() OR public.teacher_teaches_student(auth.uid(), student_id))
  );

CREATE POLICY "Teacher inserts own reply" ON public.parent_teacher_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_role = 'teacher'
    AND teacher_id = auth.uid()
    AND public.teacher_teaches_student(auth.uid(), student_id)
  );

CREATE POLICY "Teacher marks read" ON public.parent_teacher_messages
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Staff inserts" ON public.parent_teacher_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'director'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- 2) payment_notifications
CREATE TABLE public.payment_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('remind_5','remind_3','remind_1','overdue_0','overdue_recurring','paid_confirm')),
  parent_chat_id text,
  due_date date,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','skipped','error')),
  error text,
  payload jsonb
);
-- Dedup: no duplicate same-type same-day for a student/period
CREATE UNIQUE INDEX ux_paynotif_dedup
  ON public.payment_notifications(student_id, period_month, notification_type, ((sent_at AT TIME ZONE 'UTC')::date));
CREATE INDEX idx_paynotif_student ON public.payment_notifications(student_id, sent_at DESC);

GRANT SELECT ON public.payment_notifications TO authenticated;
GRANT ALL ON public.payment_notifications TO service_role;
ALTER TABLE public.payment_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read payment notifications" ON public.payment_notifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'director'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3) helper: which teachers work with a student (for parent menu picker)
CREATE OR REPLACE FUNCTION public.teachers_for_student(_student_id uuid)
RETURNS TABLE(teacher_id uuid, subject_name text, group_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT g.teacher_id, s.name AS subject_name, g.name AS group_name
  FROM public.groups g
  LEFT JOIN public.subjects s ON s.id = g.subject_id
  WHERE g.teacher_id IS NOT NULL
    AND (g.id = (SELECT group_id FROM public.students WHERE id = _student_id)
         OR EXISTS (SELECT 1 FROM public.student_enrollments e
                    WHERE e.student_id = _student_id AND e.group_id = g.id));
$$;
REVOKE ALL ON FUNCTION public.teachers_for_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teachers_for_student(uuid) TO authenticated, service_role;
