-- 1) Parent-submitted payment receipts awaiting staff confirmation
CREATE TABLE public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  parent_chat_id text,
  parent_name text,
  declared_amount numeric,
  period_month date NOT NULL DEFAULT date_trunc('month', now())::date,
  payment_method text NOT NULL DEFAULT 'card',
  note text,
  telegram_file_id text,
  storage_path text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payment_receipts_status_idx ON public.payment_receipts (status, created_at DESC);
CREATE INDEX payment_receipts_student_idx ON public.payment_receipts (student_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_receipts TO authenticated;
GRANT ALL ON public.payment_receipts TO service_role;

ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_receipts_staff_read" ON public.payment_receipts
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'director'::public.app_role));

CREATE POLICY "payment_receipts_staff_write" ON public.payment_receipts
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'director'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'director'::public.app_role));

CREATE POLICY "payment_receipts_staff_delete" ON public.payment_receipts
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'director'::public.app_role));

CREATE TRIGGER trg_payment_receipts_updated
  BEFORE UPDATE ON public.payment_receipts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Receipt images: staff-only read from the private bucket
CREATE POLICY "payment_receipts_objects_staff_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'director'::public.app_role))
  );

-- 3) Automatic teacher payroll basis: students count x monthly fee
CREATE OR REPLACE FUNCTION public.teacher_payroll_preview(p_period date)
RETURNS TABLE(
  teacher_user_id uuid,
  teacher_name text,
  students_count bigint,
  expected_total numeric,
  collected_total numeric,
  percent numeric,
  bonus numeric,
  penalty numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT g.teacher_id AS teacher_user_id,
           count(s.id) AS students_count,
           coalesce(sum(coalesce(s.monthly_fee, 0)), 0) AS expected_total,
           coalesce(sum((
             SELECT coalesce(sum(coalesce(p.total_amount, p.amount)), 0)
               FROM public.payments p
              WHERE p.student_id = s.id
                AND p.status = 'paid'
                AND date_trunc('month', p.period_month)::date = date_trunc('month', p_period)::date
           )), 0) AS collected_total
      FROM public.groups g
      JOIN public.students s ON s.group_id = g.id
     WHERE g.teacher_id IS NOT NULL
       AND coalesce(s.status_enum::text, 'active') = 'active'
     GROUP BY g.teacher_id
  )
  SELECT b.teacher_user_id,
         coalesce(pr.full_name, '—'),
         b.students_count,
         b.expected_total,
         b.collected_total,
         coalesce(tb.percent, 0),
         coalesce(tb.bonus, 0),
         coalesce(tb.penalty, 0)
    FROM base b
    LEFT JOIN public.profiles pr ON pr.id = b.teacher_user_id
    LEFT JOIN public.teacher_balance tb
      ON tb.teacher_user_id = b.teacher_user_id
     AND date_trunc('month', tb.period_month)::date = date_trunc('month', p_period)::date
   ORDER BY b.students_count DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.teacher_payroll_preview(date) FROM anon;