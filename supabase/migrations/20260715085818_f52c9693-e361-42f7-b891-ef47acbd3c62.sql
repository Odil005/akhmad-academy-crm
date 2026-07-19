
CREATE INDEX IF NOT EXISTS idx_groups_subject ON public.groups(subject_id);
CREATE INDEX IF NOT EXISTS idx_groups_teacher ON public.groups(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_group ON public.students(group_id);
CREATE INDEX IF NOT EXISTS idx_students_profile ON public.students(profile_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_period ON public.payments(student_id, period_month);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
ANALYZE public.groups;
ANALYZE public.students;
ANALYZE public.student_enrollments;
ANALYZE public.payments;
