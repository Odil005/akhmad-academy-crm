-- ============ 1-BOSQICH: pul oqimi avtomatlashtirish ============

-- 1) Bo'lib to'lash rejalari
CREATE TABLE IF NOT EXISTS public.payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  total_amount numeric NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_plans TO authenticated;
GRANT ALL ON public.payment_plans TO service_role;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_plans_staff_all ON public.payment_plans FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director'));
CREATE TRIGGER trg_payment_plans_updated BEFORE UPDATE ON public.payment_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.payment_plan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  position integer NOT NULL,
  amount numeric NOT NULL,
  due_date date NOT NULL,
  paid_at timestamptz,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_plan_installments TO authenticated;
GRANT ALL ON public.payment_plan_installments TO service_role;
ALTER TABLE public.payment_plan_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_plan_installments_staff_all ON public.payment_plan_installments FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director'));
CREATE INDEX IF NOT EXISTS payment_plan_installments_plan_idx ON public.payment_plan_installments(plan_id, position);

-- 2) Chegirma / aksiya qoidalari
CREATE TABLE IF NOT EXISTS public.discount_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  kind text NOT NULL DEFAULT 'percent',
  value numeric NOT NULL,
  reason text,
  active boolean NOT NULL DEFAULT true,
  auto_apply boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_rules TO authenticated;
GRANT ALL ON public.discount_rules TO service_role;
ALTER TABLE public.discount_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY discount_rules_staff_read ON public.discount_rules FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director') OR private.has_role(auth.uid(), 'teacher'));
CREATE POLICY discount_rules_staff_write ON public.discount_rules FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director'));
CREATE TRIGGER trg_discount_rules_updated BEFORE UPDATE ON public.discount_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Kunlik kassa yopilishi (sverka)
CREATE TABLE IF NOT EXISTS public.cash_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_date date NOT NULL,
  expected_cash numeric NOT NULL DEFAULT 0,
  expected_card numeric NOT NULL DEFAULT 0,
  expected_online numeric NOT NULL DEFAULT 0,
  counted_cash numeric NOT NULL DEFAULT 0,
  counted_card numeric NOT NULL DEFAULT 0,
  counted_online numeric NOT NULL DEFAULT 0,
  difference numeric NOT NULL DEFAULT 0,
  note text,
  closed_by uuid,
  closed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_date)
);
GRANT SELECT, INSERT, UPDATE ON public.cash_shifts TO authenticated;
GRANT ALL ON public.cash_shifts TO service_role;
ALTER TABLE public.cash_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY cash_shifts_staff_read ON public.cash_shifts FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director'));
CREATE POLICY cash_shifts_staff_write ON public.cash_shifts FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director'));
CREATE TRIGGER trg_cash_shifts_updated BEFORE UPDATE ON public.cash_shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Qarzdorlar panelini bir so'rovda to'ldiruvchi funksiya
CREATE OR REPLACE FUNCTION public.debtors_overview()
RETURNS TABLE(
  student_id uuid,
  student_name text,
  parent_phone text,
  parent_chat_id text,
  group_name text,
  debt_total numeric,
  periods integer,
  oldest_period date,
  days_overdue integer,
  last_reminder_at timestamptz,
  has_plan boolean
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH debt AS (
    SELECT p.student_id,
           sum(coalesce(p.total_amount, p.amount)) AS debt_total,
           count(*)::int AS periods,
           min(p.period_month) AS oldest_period
      FROM public.payments p
     WHERE p.status = 'pending'
     GROUP BY p.student_id
  )
  SELECT s.id,
         coalesce(nullif(trim(coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, '')), ''), s.full_name, 'Noma''lum'),
         coalesce(s.parent_phone, (s.parent_phones)[1]),
         s.parent_telegram_chat_id,
         g.name,
         d.debt_total,
         d.periods,
         d.oldest_period,
         greatest(0, (current_date - (d.oldest_period + INTERVAL '10 days')::date))::int,
         (SELECT max(pn.sent_at) FROM public.payment_notifications pn WHERE pn.student_id = s.id),
         EXISTS (SELECT 1 FROM public.payment_plans pp WHERE pp.student_id = s.id AND pp.status = 'active')
    FROM debt d
    JOIN public.students s ON s.id = d.student_id
    LEFT JOIN public.groups g ON g.id = s.group_id
   ORDER BY d.debt_total DESC;
$$;
REVOKE ALL ON FUNCTION public.debtors_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debtors_overview() TO authenticated, service_role;

-- 5) Kunlik kassa kutilgan summalari (to'lov usuli bo'yicha)
CREATE OR REPLACE FUNCTION public.cash_shift_expected(p_date date)
RETURNS TABLE(method text, total numeric, payments_count bigint)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT coalesce(p.payment_method, 'cash'),
         sum(coalesce(p.total_amount, p.amount)),
         count(*)
    FROM public.payments p
   WHERE p.status = 'paid'
     AND p.paid_at >= p_date::timestamptz
     AND p.paid_at < (p_date + 1)::timestamptz
   GROUP BY 1;
$$;
REVOKE ALL ON FUNCTION public.cash_shift_expected(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cash_shift_expected(date) TO authenticated, service_role;