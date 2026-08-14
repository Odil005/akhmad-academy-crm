-- Student numerical grades are retired. Historical rows stay intact for audit,
-- but the client roles cannot read or change them any longer.

DROP TRIGGER IF EXISTS trg_parent_notify_grade ON public.grades;
DROP POLICY IF EXISTS "Staff manage grades" ON public.grades;
DROP POLICY IF EXISTS "Teacher manages own grades" ON public.grades;
DROP POLICY IF EXISTS "Student views own grades" ON public.grades;
REVOKE ALL ON TABLE public.grades FROM anon, authenticated;
GRANT ALL ON TABLE public.grades TO service_role;
DROP FUNCTION IF EXISTS public.parent_notify_grade();

-- Class activity is an internal teacher record. Directors and administrators
-- retain audit visibility; students and parents have no read access.
DROP POLICY IF EXISTS "be: staff read" ON public.behavior_evaluations;
DROP POLICY IF EXISTS "activity: teacher and management read" ON public.behavior_evaluations;
CREATE POLICY "activity: teacher and management read"
ON public.behavior_evaluations
FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'director'::public.app_role)
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    private.has_role(auth.uid(), 'teacher'::public.app_role)
    AND teacher_id = auth.uid()
  )
);

-- Activity records are no longer shared through the parent Telegram bot.
DROP TRIGGER IF EXISTS trg_parent_notify_behavior ON public.behavior_evaluations;
DROP FUNCTION IF EXISTS public.parent_notify_behavior();

UPDATE public.parent_notifications
SET
  status = 'skipped',
  error = 'disabled: grades and class activity are internal only',
  sent_at = COALESCE(sent_at, now())
WHERE status = 'pending'
  AND kind IN ('grade', 'behavior');
