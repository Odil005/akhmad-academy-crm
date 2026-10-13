ALTER TABLE public.students ADD COLUMN IF NOT EXISTS credit_balance numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS settled_by uuid;

CREATE OR REPLACE FUNCTION public.payment_allocate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_avail numeric := COALESCE(NEW.total_amount, NEW.amount, 0);
  v_touched boolean := false;
  inv RECORD; v_due numeric;
BEGIN
  IF NEW.status <> 'paid' OR v_avail <= 0 THEN RETURN NEW; END IF;
  FOR inv IN
    SELECT id, COALESCE(total_amount, amount) AS due FROM public.payments
     WHERE student_id = NEW.student_id AND status = 'pending' AND id <> NEW.id
     ORDER BY period_month, created_at FOR UPDATE
  LOOP
    EXIT WHEN v_avail <= 0;
    v_touched := true;
    v_due := COALESCE(inv.due, 0);
    IF v_avail >= v_due THEN
      UPDATE public.payments SET status = 'settled', paid_amount = paid_amount + v_due,
        amount = 0, total_amount = 0, settled_by = NEW.id, paid_at = COALESCE(NEW.paid_at, now()) WHERE id = inv.id;
      v_avail := v_avail - v_due;
    ELSE
      UPDATE public.payments SET paid_amount = paid_amount + v_avail,
        amount = v_due - v_avail, total_amount = v_due - v_avail, settled_by = NEW.id,
        note = trim(COALESCE(note, '') || ' · Qisman to''langan') WHERE id = inv.id;
      v_avail := 0;
    END IF;
  END LOOP;
  IF v_touched AND v_avail > 0 THEN
    UPDATE public.students SET credit_balance = credit_balance + v_avail WHERE id = NEW.student_id;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_payment_allocate ON public.payments;
CREATE TRIGGER trg_payment_allocate AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.payment_allocate();

CREATE OR REPLACE FUNCTION public.generate_monthly_invoices(p_month date DEFAULT date_trunc('month', now())::date)
RETURNS TABLE(created_count integer, total_amount numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
      COALESCE(NULLIF((SELECT sum(e.monthly_fee) FROM public.student_enrollments e
        WHERE e.student_id = s.id AND COALESCE(e.status,'active') = 'active'
          AND (e.ended_at IS NULL OR e.ended_at >= v_month)), 0), s.monthly_fee, 0) AS fee
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
END; $$;
REVOKE ALL ON FUNCTION public.generate_monthly_invoices(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.generate_monthly_invoices(date) TO authenticated, service_role;