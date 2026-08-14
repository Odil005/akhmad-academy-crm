CREATE TABLE IF NOT EXISTS public.teacher_monthly_kpi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  attendance_points numeric NOT NULL DEFAULT 0 CHECK (attendance_points BETWEEN 0 AND 25),
  student_attendance_points numeric NOT NULL DEFAULT 0 CHECK (student_attendance_points BETWEEN 0 AND 20),
  grading_points numeric NOT NULL DEFAULT 0 CHECK (grading_points BETWEEN 0 AND 15),
  retention_points numeric NOT NULL DEFAULT 0 CHECK (retention_points BETWEEN 0 AND 15),
  results_points numeric NOT NULL DEFAULT 0 CHECK (results_points BETWEEN 0 AND 15),
  materials_points numeric NOT NULL DEFAULT 0 CHECK (materials_points BETWEEN 0 AND 10),
  total_score numeric GENERATED ALWAYS AS (attendance_points + student_attendance_points + grading_points + retention_points + results_points + materials_points) STORED,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_user_id, period_month)
);
CREATE INDEX IF NOT EXISTS teacher_monthly_kpi_period_idx ON public.teacher_monthly_kpi (period_month DESC, total_score DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_monthly_kpi TO authenticated;
ALTER TABLE public.teacher_monthly_kpi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kpi managers manage" ON public.teacher_monthly_kpi FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'director'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'director'::public.app_role));
CREATE POLICY "kpi teacher reads own" ON public.teacher_monthly_kpi FOR SELECT TO authenticated
USING (teacher_user_id = auth.uid());
