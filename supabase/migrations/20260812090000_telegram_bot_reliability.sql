-- Telegram bot reliability and least-privilege access.

ALTER TABLE public.parent_notifications
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_parent_notifications_processing
  ON public.parent_notifications (processing_started_at)
  WHERE status = 'processing';

-- Link tokens are created by authenticated server functions and consumed only
-- by the service-role webhook. Users never need to list or modify token rows.
DROP POLICY IF EXISTS "parent_link_tokens: staff manage" ON public.parent_link_tokens;
REVOKE SELECT, UPDATE, DELETE ON public.parent_link_tokens FROM authenticated;
GRANT INSERT ON public.parent_link_tokens TO authenticated;

CREATE POLICY "parent_link_tokens: scoped insert"
ON public.parent_link_tokens FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    private.has_role(auth.uid(), 'director'::public.app_role)
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      private.has_role(auth.uid(), 'teacher'::public.app_role)
      AND EXISTS (
        SELECT 1
        FROM public.student_enrollments se
        WHERE se.student_id = parent_link_tokens.student_id
          AND se.teacher_user_id = auth.uid()
          AND se.status IN ('active', 'trial')
          AND se.ended_at IS NULL
      )
    )
  )
);

DROP POLICY IF EXISTS "Staff manage telegram link tokens" ON public.telegram_link_tokens;
REVOKE SELECT, UPDATE, DELETE ON public.telegram_link_tokens FROM authenticated;
GRANT INSERT ON public.telegram_link_tokens TO authenticated;

CREATE POLICY "telegram_link_tokens: scoped insert"
ON public.telegram_link_tokens FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    private.has_role(auth.uid(), 'director'::public.app_role)
    OR (
      private.has_role(auth.uid(), 'admin'::public.app_role)
      AND (
        kind IN ('student', 'teacher')
        OR (kind = 'admin' AND user_id = auth.uid())
      )
    )
    OR (
      private.has_role(auth.uid(), 'teacher'::public.app_role)
      AND (
        (kind = 'teacher' AND user_id = auth.uid())
        OR (
          kind = 'student'
          AND EXISTS (
            SELECT 1
            FROM public.student_enrollments se
            WHERE se.student_id = telegram_link_tokens.student_id
              AND se.teacher_user_id = auth.uid()
              AND se.status IN ('active', 'trial')
              AND se.ended_at IS NULL
          )
        )
      )
    )
  )
);

DROP POLICY IF EXISTS "Staff admins manage staff telegram links" ON public.staff_telegram_links;
REVOKE INSERT, UPDATE, DELETE ON public.staff_telegram_links FROM authenticated;

CREATE POLICY "Managers can view staff telegram links"
ON public.staff_telegram_links FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'director'::public.app_role)
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
);
