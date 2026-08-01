ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS schedule_raw text,
  ADD COLUMN IF NOT EXISTS schedule_type text,
  ADD COLUMN IF NOT EXISTS lesson_time text,
  ADD COLUMN IF NOT EXISTS parent_phones text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS monthly_fee numeric,
  ADD COLUMN IF NOT EXISTS academic_year text,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid;

ALTER TABLE public.students ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE public.students ALTER COLUMN last_name DROP NOT NULL;

CREATE INDEX IF NOT EXISTS students_import_batch_idx ON public.students (import_batch_id);

CREATE TABLE IF NOT EXISTS public.import_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL DEFAULT 'students',
  file_name text,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  academic_year text,
  total integer NOT NULL DEFAULT 0,
  inserted integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  duplicates integer NOT NULL DEFAULT 0,
  warnings integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  undone_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_batches_staff_all" ON public.import_batches
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'director'::public.app_role) OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'director'::public.app_role) OR private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER import_batches_set_updated_at
  BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();