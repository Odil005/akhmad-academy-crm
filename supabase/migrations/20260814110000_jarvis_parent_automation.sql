-- Jarvis parent communication and least-privilege notification access.
-- Numerical grades stay disabled. Only class activity is re-enabled for parents.

CREATE OR REPLACE FUNCTION public.parent_notify_behavior()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  student_row record;
BEGIN
  SELECT id, parent_telegram_chat_id, parent_notifications_enabled
  INTO student_row
  FROM public.students
  WHERE id = NEW.student_id;

  IF student_row.id IS NULL
     OR student_row.parent_telegram_chat_id IS NULL
     OR NOT student_row.parent_notifications_enabled THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.parent_notifications (student_id, kind, channel, payload, status)
  VALUES (
    NEW.student_id,
    'behavior',
    'telegram',
    jsonb_build_object(
      'ref_id', NEW.id::text,
      'rating', NEW.rating::text,
      'comment', NEW.comment,
      'lesson_date', NEW.lesson_date
    ),
    'pending'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.parent_notify_behavior() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_parent_notify_behavior ON public.behavior_evaluations;
CREATE TRIGGER trg_parent_notify_behavior
AFTER INSERT ON public.behavior_evaluations
FOR EACH ROW EXECUTE FUNCTION public.parent_notify_behavior();

-- Teachers may queue a message only for their own active students.
DROP POLICY IF EXISTS "pn: authed insert" ON public.parent_notifications;
DROP POLICY IF EXISTS "pn: scoped staff insert" ON public.parent_notifications;
CREATE POLICY "pn: scoped staff insert"
ON public.parent_notifications
FOR INSERT TO authenticated
WITH CHECK (
  private.has_role(auth.uid(), 'director'::public.app_role)
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    private.has_role(auth.uid(), 'teacher'::public.app_role)
    AND (
      EXISTS (
        SELECT 1
        FROM public.student_enrollments enrollment
        LEFT JOIN public.groups enrolled_group ON enrolled_group.id = enrollment.group_id
        WHERE enrollment.student_id = parent_notifications.student_id
          AND enrollment.status IN ('active', 'trial')
          AND enrollment.ended_at IS NULL
          AND (
            enrollment.teacher_user_id = auth.uid()
            OR enrolled_group.teacher_id = auth.uid()
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.students student
        JOIN public.groups legacy_group ON legacy_group.id = student.group_id
        WHERE student.id = parent_notifications.student_id
          AND legacy_group.teacher_id = auth.uid()
      )
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_parent_messages_unread_role
  ON public.parent_teacher_messages (teacher_id, created_at DESC)
  WHERE sender_role = 'parent' AND read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_parent_notifications_failed_recent
  ON public.parent_notifications (created_at DESC, attempts)
  WHERE status IN ('failed', 'error');
