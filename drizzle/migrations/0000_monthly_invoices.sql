CREATE OR REPLACE FUNCTION public.generate_monthly_invoices(p_month date DEFAULT date_trunc('month', now())::date)
RETURNS TABLE(created_count integer, total_amount numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_month date := date_trunc('month', p_month)::date;
  v_count integer := 0; v_total numeric := 0;
  r RECORD; v_disc numeric; v_reason text; v_net numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('director','admin')
  ) THEN RAISE EXCEPTION 'Ruxsat yo''q'; END IF;

  FOR r IN
    SELECT s.id AS student_id, s.center_id,
      COALESCE(NULLIF((SELECT sum(e.monthly_fee) FROM public.student_enrollments e
        WHERE e.student_id = s.id AND COALESCE(e.status,'active') = 'active'
          AND (e.ended_at IS NULL OR e.ended_at >= v_month)), 0), s.monthly_fee, 0) AS fee
    FROM public.students s
    WHERE s.status_enum = 'active'
      AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.student_id = s.id AND p.period_month = v_month)
  LOOP
    CONTINUE WHEN r.fee IS NULL OR r.fee <= 0;
    SELECT CASE WHEN d.kind IN ('percent','percentage') THEN round(r.fee * d.value / 100) ELSE d.value END, d.name
      INTO v_disc, v_reason
      FROM public.discount_rules d WHERE d.active AND d.auto_apply
      ORDER BY CASE WHEN d.kind IN ('percent','percentage') THEN r.fee * d.value / 100 ELSE d.value END DESC LIMIT 1;
    v_disc := LEAST(COALESCE(v_disc, 0), r.fee);
    v_net := r.fee - v_disc;
    INSERT INTO public.payments (student_id, amount, subtotal, discount_amount, discount_reason, total_amount,
      period_month, next_due_date, status, note, center_id, idempotency_key)
    VALUES (r.student_id, v_net, r.fee, v_disc, v_reason, v_net, v_month, v_month + 9, 'pending',
      'Avtomatik oylik hisob', r.center_id, 'invoice:' || r.student_id || ':' || v_month)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_count := v_count + 1; v_total := v_total + v_net; END IF;
  END LOOP;
  RETURN QUERY SELECT v_count, v_total;
END; $$;
REVOKE ALL ON FUNCTION public.generate_monthly_invoices(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.generate_monthly_invoices(date) TO authenticated, service_role;