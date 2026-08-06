-- Additive only. No DROP / DELETE / TRUNCATE / RENAME.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS telegram_username text,
  ADD COLUMN IF NOT EXISTS telegram_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS telegram_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS telegram_last_error text;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS telegram_username text,
  ADD COLUMN IF NOT EXISTS telegram_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS telegram_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS telegram_last_error text;

CREATE TABLE IF NOT EXISTS public.telegram_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_kind text NOT NULL,
  subject_id uuid NOT NULL,
  action text NOT NULL,
  chat_id text,
  success boolean NOT NULL DEFAULT false,
  error text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.telegram_audit_log TO authenticated;
GRANT ALL ON public.telegram_audit_log TO service_role;

ALTER TABLE public.telegram_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read telegram audit log"
  ON public.telegram_audit_log FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'director'::public.app_role)
      OR private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_telegram_audit_subject ON public.telegram_audit_log (subject_kind, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lessons_teacher ON public.lessons (teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_lessons_group ON public.lessons (group_id);
CREATE INDEX IF NOT EXISTS idx_lessons_day_time ON public.lessons (day_of_week, start_time);
CREATE INDEX IF NOT EXISTS idx_groups_teacher ON public.groups (teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_group ON public.students (group_id);