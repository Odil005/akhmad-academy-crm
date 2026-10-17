CREATE INDEX IF NOT EXISTS idx_payments_student_status ON public.payments(student_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_period ON public.payments(period_month);
CREATE INDEX IF NOT EXISTS idx_payments_created ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_group ON public.students(group_id);
CREATE INDEX IF NOT EXISTS idx_students_tg ON public.students(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_enroll_student ON public.student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_face_checkins_student ON public.student_face_checkins(student_id, created_at DESC);