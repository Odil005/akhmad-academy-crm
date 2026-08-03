ALTER TABLE public.students ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;
CREATE INDEX IF NOT EXISTS students_birth_date_idx ON public.students (birth_date);