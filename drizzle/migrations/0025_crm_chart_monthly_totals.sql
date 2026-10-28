CREATE OR REPLACE FUNCTION public.crm_chart_monthly_totals(p_boundaries timestamptz[])
RETURNS TABLE(bucket integer, income numeric, expense numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  WITH months AS (
    SELECT i AS bucket, p_boundaries[i] AS starts_at, p_boundaries[i+1] AS ends_at
    FROM generate_series(1,6) AS i
    WHERE array_length(p_boundaries,1) = 7
  )
  SELECT m.bucket,
    COALESCE(sum(t.amount) FILTER (WHERE t.type = 'income'),0)::numeric,
    COALESCE(sum(t.amount) FILTER (WHERE t.type = 'expense'),0)::numeric
  FROM months m LEFT JOIN public.transactions t
    ON t.occurred_at >= m.starts_at AND t.occurred_at < m.ends_at
  GROUP BY m.bucket ORDER BY m.bucket;
$$;
REVOKE ALL ON FUNCTION public.crm_chart_monthly_totals(timestamptz[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_chart_monthly_totals(timestamptz[]) TO authenticated, service_role;