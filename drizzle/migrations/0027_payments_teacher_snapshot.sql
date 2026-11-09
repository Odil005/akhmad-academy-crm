-- Payment saving writes the group's teacher as a historical snapshot; the column was missing,
-- so every new payment failed before the receipt could print.
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS teacher_user_id uuid;
UPDATE public.payments p
   SET teacher_user_id = g.teacher_id
  FROM public.groups g
 WHERE p.course_id = g.id AND p.teacher_user_id IS NULL;
CREATE INDEX IF NOT EXISTS payments_teacher_paid_at_idx
  ON public.payments (teacher_user_id, status, paid_at);
NOTIFY pgrst, 'reload schema';