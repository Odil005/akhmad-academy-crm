-- Frequently used CRM filters. These indexes avoid full-table scans as the
-- academy grows and keep dashboard, payments and timetable queries responsive.
CREATE INDEX IF NOT EXISTS idx_students_status_enum ON public.students (status_enum);
CREATE INDEX IF NOT EXISTS idx_payments_status_period ON public.payments (status, period_month);
CREATE INDEX IF NOT EXISTS idx_payments_status_paid_at ON public.payments (status, paid_at);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance (date);
CREATE INDEX IF NOT EXISTS idx_lessons_active_day_time ON public.lessons (is_active, day_of_week, start_time);
ANALYZE public.students;
ANALYZE public.payments;
ANALYZE public.attendance;
ANALYZE public.lessons;
