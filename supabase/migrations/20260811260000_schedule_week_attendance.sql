-- One compact row per visible recurring lesson in the requested week.  The
-- timetable can render attendance-needed indicators without downloading every
-- individual attendance record to the browser.
CREATE OR REPLACE FUNCTION public.schedule_week_attendance(p_week_start date)
RETURNS TABLE (
  lesson_id uuid,
  attendance_date date,
  attendance_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH selected_week AS (
    -- Treat the argument as a week selector even if a caller passes a date
    -- other than Monday. PostgreSQL ISODOW uses Monday=1 through Sunday=7.
    SELECT (
      p_week_start - (EXTRACT(ISODOW FROM p_week_start)::integer - 1)
    )::date AS monday
  ),
  visible_lessons AS (
    SELECT
      lesson.id,
      (selected_week.monday + (lesson.day_of_week - 1))::date AS attendance_date
    FROM public.lessons lesson
    CROSS JOIN selected_week
    WHERE lesson.is_active
      AND (
        private.has_role(auth.uid(), 'director'::public.app_role)
        OR private.has_role(auth.uid(), 'admin'::public.app_role)
        OR (
          private.has_role(auth.uid(), 'teacher'::public.app_role)
          AND lesson.teacher_user_id = auth.uid()
        )
      )
  )
  SELECT
    lesson.id AS lesson_id,
    lesson.attendance_date,
    count(attendance_row.id)::bigint AS attendance_count
  FROM visible_lessons lesson
  LEFT JOIN public.attendance attendance_row
    ON attendance_row.lesson_id = lesson.id
    AND attendance_row.date = lesson.attendance_date
  GROUP BY lesson.id, lesson.attendance_date;
$$;

REVOKE ALL ON FUNCTION public.schedule_week_attendance(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_week_attendance(date) TO authenticated;
