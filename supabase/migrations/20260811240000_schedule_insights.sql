-- Return compact schedule indicators instead of transferring thousands of
-- attendance/enrollment rows to every browser opening the timetable.
CREATE INDEX IF NOT EXISTS idx_enrollments_group_status_ended_student
  ON public.student_enrollments (group_id, status, ended_at, student_id);

CREATE OR REPLACE FUNCTION public.schedule_insights(p_since date)
RETURNS TABLE (
  lesson_id uuid,
  group_id uuid,
  attendance_total bigint,
  attendance_ok bigint,
  enrolled_students bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible_lessons AS (
    SELECT lesson.id, lesson.group_id
    FROM public.lessons lesson
    WHERE lesson.is_active
      AND (
        private.has_role(auth.uid(), 'director'::public.app_role)
        OR private.has_role(auth.uid(), 'admin'::public.app_role)
        OR (
          private.has_role(auth.uid(), 'teacher'::public.app_role)
          AND lesson.teacher_user_id = auth.uid()
        )
      )
  ),
  attendance_counts AS (
    SELECT
      attendance_row.lesson_id,
      count(*) AS total,
      count(*) FILTER (WHERE attendance_row.status IN ('present', 'late')) AS ok
    FROM public.attendance attendance_row
    JOIN visible_lessons lesson ON lesson.id = attendance_row.lesson_id
    WHERE attendance_row.date >= p_since
    GROUP BY attendance_row.lesson_id
  ),
  enrollment_counts AS (
    SELECT
      lesson_group.group_id,
      count(DISTINCT enrollment_row.student_id) AS total
    FROM (SELECT DISTINCT group_id FROM visible_lessons) lesson_group
    LEFT JOIN public.student_enrollments enrollment_row
      ON enrollment_row.group_id = lesson_group.group_id
      AND enrollment_row.status IN ('active', 'trial')
      AND (enrollment_row.ended_at IS NULL OR enrollment_row.ended_at >= CURRENT_DATE)
    GROUP BY lesson_group.group_id
  )
  SELECT
    lesson.id,
    lesson.group_id,
    COALESCE(attendance.total, 0)::bigint,
    COALESCE(attendance.ok, 0)::bigint,
    COALESCE(enrollment.total, 0)::bigint
  FROM visible_lessons lesson
  LEFT JOIN attendance_counts attendance ON attendance.lesson_id = lesson.id
  LEFT JOIN enrollment_counts enrollment ON enrollment.group_id = lesson.group_id;
$$;

REVOKE ALL ON FUNCTION public.schedule_insights(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_insights(date) TO authenticated;
