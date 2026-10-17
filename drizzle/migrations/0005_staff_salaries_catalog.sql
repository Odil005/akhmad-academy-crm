CREATE TABLE public.staff_salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_name text NOT NULL,
  position text NOT NULL DEFAULT 'teacher',
  monthly_salary numeric NOT NULL DEFAULT 0,
  period_month date NOT NULL,
  paid_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_salaries TO authenticated;
GRANT ALL ON public.staff_salaries TO service_role;
ALTER TABLE public.staff_salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_salaries_staff_all ON public.staff_salaries
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'director'::app_role));