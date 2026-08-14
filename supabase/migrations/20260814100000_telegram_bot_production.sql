-- Production hardening for Telegram webhook delivery and account linking.

CREATE TABLE IF NOT EXISTS public.telegram_webhook_updates (
  update_id bigint PRIMARY KEY,
  update_kind text NOT NULL,
  chat_id text,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_error text
);

ALTER TABLE public.telegram_webhook_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_webhook_updates FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.telegram_webhook_updates TO service_role;

CREATE INDEX IF NOT EXISTS telegram_webhook_updates_started_idx
  ON public.telegram_webhook_updates (started_at DESC);

CREATE OR REPLACE FUNCTION public.claim_telegram_update(
  p_update_id bigint,
  p_update_kind text,
  p_chat_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  affected integer;
BEGIN
  INSERT INTO public.telegram_webhook_updates (
    update_id, update_kind, chat_id, status, attempts, started_at
  ) VALUES (
    p_update_id, left(coalesce(p_update_kind, 'unknown'), 40), p_chat_id,
    'processing', 1, now()
  )
  ON CONFLICT (update_id) DO UPDATE
    SET status = 'processing',
        attempts = telegram_webhook_updates.attempts + 1,
        started_at = now(),
        completed_at = NULL,
        last_error = NULL
    WHERE telegram_webhook_updates.status = 'failed'
       OR (
         telegram_webhook_updates.status = 'processing'
         AND telegram_webhook_updates.started_at < now() - interval '2 minutes'
       );

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_telegram_update(
  p_update_id bigint,
  p_success boolean,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.telegram_webhook_updates
  SET status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
      completed_at = now(),
      last_error = CASE WHEN p_success THEN NULL ELSE left(coalesce(p_error, 'unknown'), 1000) END
  WHERE update_id = p_update_id;
$$;

REVOKE ALL ON FUNCTION public.claim_telegram_update(bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_telegram_update(bigint, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_telegram_update(bigint, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_telegram_update(bigint, boolean, text) TO service_role;

-- Avoid downloading the entire student table when a parent shares a phone.
CREATE OR REPLACE FUNCTION public.telegram_students_by_parent_phone(p_phone text)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  full_name text,
  parent_phone text,
  parent_phones text[],
  parent_telegram_chat_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    s.id,
    s.first_name,
    s.last_name,
    s.full_name,
    s.parent_phone,
    s.parent_phones,
    s.parent_telegram_chat_id
  FROM public.students s
  WHERE length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) >= 7
    AND (
      right(regexp_replace(coalesce(s.parent_phone, ''), '[^0-9]', '', 'g'), 9)
        = right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 9)
      OR EXISTS (
        SELECT 1
        FROM unnest(coalesce(s.parent_phones, '{}'::text[])) AS phone(value)
        WHERE right(regexp_replace(phone.value, '[^0-9]', '', 'g'), 9)
          = right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 9)
      )
    )
  ORDER BY s.enrolled_at DESC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.telegram_students_by_parent_phone(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_students_by_parent_phone(text) TO service_role;

CREATE OR REPLACE FUNCTION public.telegram_center_report()
RETURNS TABLE (
  active_students bigint,
  groups_count bigint,
  debtors bigint,
  debt_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH students_total AS (
    SELECT count(*)::bigint AS active_students
    FROM public.students
    WHERE status_enum = 'active'::public.student_status
  ),
  groups_total AS (
    SELECT count(*)::bigint AS groups_count FROM public.groups
  ),
  debt AS (
    SELECT
      count(DISTINCT student_id) FILTER (
        WHERE coalesce(nullif(total_amount, 0), amount, 0) > 0
      )::bigint AS debtors,
      coalesce(sum(coalesce(nullif(total_amount, 0), amount, 0)), 0)::numeric AS debt_total
    FROM public.payments
    WHERE status = 'pending'
  )
  SELECT
    students_total.active_students,
    groups_total.groups_count,
    debt.debtors,
    debt.debt_total
  FROM students_total
  CROSS JOIN groups_total
  CROSS JOIN debt;
$$;

REVOKE ALL ON FUNCTION public.telegram_center_report() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_center_report() TO service_role;

CREATE INDEX IF NOT EXISTS students_telegram_chat_idx
  ON public.students (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS students_parent_telegram_chat_idx
  ON public.students (parent_telegram_chat_id)
  WHERE parent_telegram_chat_id IS NOT NULL;

-- Existing duplicate data is not deleted. New conflicting assignments are
-- rejected while siblings may still share one parent_telegram_chat_id.
CREATE OR REPLACE FUNCTION public.enforce_unique_student_telegram_chat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.telegram_chat_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.students other
    WHERE other.telegram_chat_id = NEW.telegram_chat_id
      AND other.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'Telegram chat is already linked to another student'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unique_student_telegram_chat ON public.students;
CREATE TRIGGER trg_unique_student_telegram_chat
BEFORE INSERT OR UPDATE OF telegram_chat_id ON public.students
FOR EACH ROW EXECUTE FUNCTION public.enforce_unique_student_telegram_chat();
