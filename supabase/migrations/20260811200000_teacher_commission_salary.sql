-- Admins can manage the same salary records as directors.
CREATE POLICY "tb: admin all" ON public.teacher_balance FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "tsp: admin all" ON public.teacher_salary_payments FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- The percentage administrator assigns to each teacher is reused every month.
CREATE TABLE IF NOT EXISTS public.teacher_commission_rates (
  teacher_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  percent numeric(5,2) NOT NULL CHECK (percent >= 0 AND percent <= 100),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_commission_rates TO authenticated;
ALTER TABLE public.teacher_commission_rates ENABLE ROW LEVEL SECURITY;
-- Only administrators define the rate. Directors can see it for oversight.
CREATE POLICY "commission admin all" ON public.teacher_commission_rates FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "commission director read" ON public.teacher_commission_rates FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'director'::public.app_role));
CREATE POLICY "commission teacher read own" ON public.teacher_commission_rates FOR SELECT TO authenticated
USING (teacher_user_id = auth.uid());

-- Payment ownership is kept as a historical snapshot, so group reassignment later
-- cannot change an already-earned salary calculation.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS teacher_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
UPDATE public.payments p
SET teacher_user_id = g.teacher_id
FROM public.groups g
WHERE p.course_id = g.id AND p.teacher_user_id IS NULL;
CREATE INDEX IF NOT EXISTS payments_teacher_paid_at_idx
  ON public.payments (teacher_user_id, status, paid_at);

-- A salary can be paid in several parts; each payout is linked to its month.
ALTER TABLE public.teacher_salary_payments
  ADD COLUMN IF NOT EXISTS period_month date;
CREATE INDEX IF NOT EXISTS teacher_salary_payments_teacher_period_idx
  ON public.teacher_salary_payments (teacher_user_id, period_month, paid_at);
