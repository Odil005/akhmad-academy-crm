CREATE OR REPLACE FUNCTION public.generate_monthly_invoices(p_month date DEFAULT (date_trunc('month'::text, now()))::date)
 RETURNS TABLE(created_count integer, total_amount numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_month date := date_trunc('month', p_month)::date;
  v_count integer := 0; v_total numeric := 0;
  r RECORD; v_disc numeric; v_reason text; v_net numeric; v_use numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('director','admin')
  ) THEN RAISE EXCEPTION 'Ruxsat yo''q'; END IF;

  FOR r IN
    SELECT s.id AS student_id, s.center_id, s.credit_balance,
      CASE
        WHEN (SELECT count(*) FROM public.student_enrollments e0
              WHERE e0.student_id = s.id AND COALESCE(e0.status,'active') = 'active'
                AND (e0.ended_at IS NULL OR e0.ended_at >= v_month)) > 0
        THEN COALESCE((SELECT sum(e.monthly_fee) FROM public.student_enrollments e
              WHERE e.student_id = s.id AND COALESCE(e.status,'active') = 'active'
                AND (e.ended_at IS NULL OR e.ended_at >= v_month)
                -- Face ID qoidasi: guruhda darslar bo'lsa, o'qituvchi kamida bitta darsga
                -- boshlanishidan 10 daqiqa ichida Face ID orqali kirgan bo'lishi shart.
                -- Aks holda shu guruh uchun oylik yozilmaydi.
                AND NOT EXISTS (
                  SELECT 1 FROM public.lessons l
                  WHERE l.group_id = e.group_id AND l.is_active
                    AND NOT EXISTS (
                      SELECT 1 FROM public.teacher_checkins tc
                      WHERE tc.lesson_id = l.id
                        AND tc.checked_in_at >= v_month
                        AND tc.checked_in_at < (v_month + interval '1 month')::date
                        AND tc.checked_in_at::time <= l.start_time + interval '10 minutes'
                    )
                )), 0)
        ELSE COALESCE(s.monthly_fee, 0)
      END AS fee
    FROM public.students s
    WHERE s.status_enum = 'active'
      AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.student_id = s.id AND p.period_month = v_month)
  LOOP
    CONTINUE WHEN r.fee IS NULL OR r.fee <= 0;
    v_disc := NULL; v_reason := NULL;
    SELECT CASE WHEN d.kind IN ('percent','percentage') THEN round(r.fee * d.value / 100) ELSE d.value END, d.name
      INTO v_disc, v_reason
      FROM public.discount_rules d WHERE d.active AND d.auto_apply
      ORDER BY CASE WHEN d.kind IN ('percent','percentage') THEN r.fee * d.value / 100 ELSE d.value END DESC LIMIT 1;
    v_disc := LEAST(COALESCE(v_disc, 0), r.fee);
    v_net := r.fee - v_disc;
    v_use := LEAST(GREATEST(COALESCE(r.credit_balance, 0), 0), v_net);
    INSERT INTO public.payments (student_id, amount, subtotal, discount_amount, discount_reason, total_amount, paid_amount,
      period_month, next_due_date, status, note, center_id, idempotency_key, paid_at)
    VALUES (r.student_id, v_net - v_use, r.fee, v_disc, v_reason, v_net - v_use, v_use, v_month, v_month + 9,
      CASE WHEN v_net - v_use <= 0 THEN 'settled' ELSE 'pending' END,
      CASE WHEN v_use > 0 THEN 'Avtomatik oylik hisob · oldindan to''lovdan ' || v_use ELSE 'Avtomatik oylik hisob' END,
      r.center_id, 'invoice:' || r.student_id || ':' || v_month,
      CASE WHEN v_net - v_use <= 0 THEN now() END)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN
      v_count := v_count + 1; v_total := v_total + v_net;
      IF v_use > 0 THEN UPDATE public.students SET credit_balance = credit_balance - v_use WHERE id = r.student_id; END IF;
    END IF;
  END LOOP;
  RETURN QUERY SELECT v_count, v_total;
END; $function$;