ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS low_income boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS low_income_note text;

CREATE INDEX IF NOT EXISTS students_low_income_idx ON public.students (low_income) WHERE low_income;