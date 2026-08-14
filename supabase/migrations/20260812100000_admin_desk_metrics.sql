-- Fast, exact counters for the administrator desk. The function avoids
-- downloading the full student/payment index just to render four KPI cards.
CREATE OR REPLACE FUNCTION public.admin_desk_metrics()
RETURNS TABLE (
  total_students bigint,
  active_students bigint,
  paid_this_month bigint,
  debtors bigint,
  debt_total numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    private.has_role(auth.uid(), 'director'::public.app_role)
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH student_totals AS (
    SELECT
      count(*)::bigint AS total_students,
      count(*) FILTER (WHERE s.status_enum = 'active'::public.student_status)::bigint AS active_students
    FROM public.students s
  ),
  paid AS (
    SELECT count(DISTINCT p.student_id)::bigint AS paid_this_month
    FROM public.payments p
    WHERE p.status = 'paid'
      AND p.period_month = date_trunc('month', timezone('Asia/Tashkent', now()))::date
  ),
  debt AS (
    SELECT
      count(DISTINCT p.student_id) FILTER (
        WHERE COALESCE(NULLIF(p.total_amount, 0), p.amount, 0) > 0
      )::bigint AS debtors,
      COALESCE(sum(COALESCE(NULLIF(p.total_amount, 0), p.amount, 0)), 0)::numeric AS debt_total
    FROM public.payments p
    WHERE p.status = 'pending'
  )
  SELECT
    student_totals.total_students,
    student_totals.active_students,
    paid.paid_this_month,
    debt.debtors,
    debt.debt_total
  FROM student_totals
  CROSS JOIN paid
  CROSS JOIN debt;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_desk_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_desk_metrics() TO authenticated, service_role;
