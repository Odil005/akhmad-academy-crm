-- 1. parent_notifications queue columns
ALTER TABLE public.parent_notifications
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

-- 2. Jarvis GitHub audit table
CREATE TABLE IF NOT EXISTS public.jarvis_github_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_text text NOT NULL,
  repository text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  github_issue_number integer,
  github_external_id text,
  github_url text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.jarvis_github_requests TO authenticated;
GRANT ALL ON public.jarvis_github_requests TO service_role;
ALTER TABLE public.jarvis_github_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Directors read jarvis github requests" ON public.jarvis_github_requests;
CREATE POLICY "Directors read jarvis github requests"
  ON public.jarvis_github_requests FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'director'));
DROP TRIGGER IF EXISTS set_jarvis_github_requests_updated_at ON public.jarvis_github_requests;
CREATE TRIGGER set_jarvis_github_requests_updated_at
  BEFORE UPDATE ON public.jarvis_github_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Telegram update dedupe table
CREATE TABLE IF NOT EXISTS public.telegram_updates (
  update_id bigint PRIMARY KEY,
  update_kind text,
  chat_id text,
  status text NOT NULL DEFAULT 'processing',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT ALL ON public.telegram_updates TO service_role;
ALTER TABLE public.telegram_updates ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_telegram_update(
  p_update_id bigint, p_update_kind text, p_chat_id text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.telegram_updates (update_id, update_kind, chat_id, status)
  VALUES (p_update_id, p_update_kind, NULLIF(p_chat_id, ''), 'processing')
  ON CONFLICT (update_id) DO NOTHING;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_telegram_update(bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_telegram_update(bigint, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_telegram_update(
  p_update_id bigint, p_success boolean, p_error text
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.telegram_updates
     SET status = CASE WHEN p_success THEN 'done' ELSE 'failed' END,
         error = p_error,
         finished_at = now()
   WHERE update_id = p_update_id;
$$;
REVOKE ALL ON FUNCTION public.finish_telegram_update(bigint, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_telegram_update(bigint, boolean, text) TO service_role;

-- 4. Parent phone lookup
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
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.first_name, s.last_name, s.full_name, s.parent_phone,
         s.parent_phones, s.parent_telegram_chat_id
    FROM public.students s
   WHERE regexp_replace(coalesce(s.parent_phone, ''), '\D', '', 'g')
           LIKE '%' || regexp_replace(coalesce(p_phone, 'x'), '\D', '', 'g')
      OR EXISTS (
        SELECT 1 FROM unnest(coalesce(s.parent_phones, ARRAY[]::text[])) ph
         WHERE regexp_replace(ph, '\D', '', 'g')
                 LIKE '%' || regexp_replace(coalesce(p_phone, 'x'), '\D', '', 'g')
      )
   LIMIT 20;
$$;
REVOKE ALL ON FUNCTION public.telegram_students_by_parent_phone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_students_by_parent_phone(text) TO service_role;

-- 5. Admin desk metrics
CREATE OR REPLACE FUNCTION public.admin_desk_metrics()
RETURNS TABLE (
  total_students bigint,
  active_students bigint,
  paid_this_month bigint,
  debtors bigint,
  debt_total numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM public.students),
    (SELECT count(*) FROM public.students WHERE status_enum = 'active'),
    (SELECT count(DISTINCT student_id) FROM public.payments
      WHERE status = 'paid' AND paid_at >= date_trunc('month', now())),
    (SELECT count(DISTINCT student_id) FROM public.payments WHERE status = 'pending'),
    (SELECT coalesce(sum(coalesce(total_amount, amount)), 0) FROM public.payments WHERE status = 'pending');
$$;
REVOKE ALL ON FUNCTION public.admin_desk_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_desk_metrics() TO authenticated, service_role;

-- 6. Telegram center report
CREATE OR REPLACE FUNCTION public.telegram_center_report()
RETURNS TABLE (
  active_students bigint,
  groups_count bigint,
  debtors bigint,
  debt_total numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM public.students WHERE status_enum = 'active'),
    (SELECT count(*) FROM public.groups),
    (SELECT count(DISTINCT student_id) FROM public.payments WHERE status = 'pending'),
    (SELECT coalesce(sum(coalesce(total_amount, amount)), 0) FROM public.payments WHERE status = 'pending');
$$;
REVOKE ALL ON FUNCTION public.telegram_center_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.telegram_center_report() TO authenticated, service_role;

-- 7. Schedule insights
CREATE OR REPLACE FUNCTION public.schedule_insights(p_since date)
RETURNS TABLE (
  lesson_id uuid,
  group_id uuid,
  attendance_total bigint,
  attendance_ok bigint,
  enrolled_students bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id,
         l.group_id,
         count(a.id),
         count(a.id) FILTER (WHERE a.status IN ('present', 'late')),
         (SELECT count(*) FROM public.students s
           WHERE s.group_id = l.group_id AND coalesce(s.status_enum::text, 'active') = 'active')
    FROM public.lessons l
    LEFT JOIN public.attendance a ON a.lesson_id = l.id AND a.date >= p_since
   GROUP BY l.id, l.group_id;
$$;
REVOKE ALL ON FUNCTION public.schedule_insights(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_insights(date) TO authenticated, service_role;

-- 8. Week attendance markers
CREATE OR REPLACE FUNCTION public.schedule_week_attendance(p_week_start date)
RETURNS TABLE (
  lesson_id uuid,
  attendance_date date,
  attendance_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.lesson_id, a.date, count(*)
    FROM public.attendance a
   WHERE a.date >= p_week_start
     AND a.date < p_week_start + INTERVAL '7 days'
     AND a.lesson_id IS NOT NULL
   GROUP BY a.lesson_id, a.date;
$$;
REVOKE ALL ON FUNCTION public.schedule_week_attendance(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_week_attendance(date) TO authenticated, service_role;