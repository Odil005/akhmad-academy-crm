CREATE TABLE public.center_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  center_name text NOT NULL,
  contact_name text NOT NULL,
  phone text NOT NULL,
  city text,
  plan_code text,
  students_estimate integer,
  note text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_center_id uuid REFERENCES public.centers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.center_applications TO anon;
GRANT SELECT, INSERT, UPDATE ON public.center_applications TO authenticated;
GRANT ALL ON public.center_applications TO service_role;

ALTER TABLE public.center_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_applications_insert_public" ON public.center_applications
  FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending');

CREATE POLICY "center_applications_owner_read" ON public.center_applications
  FOR SELECT TO authenticated USING (private.is_platform_owner(auth.uid()));

CREATE POLICY "center_applications_owner_update" ON public.center_applications
  FOR UPDATE TO authenticated USING (private.is_platform_owner(auth.uid()))
  WITH CHECK (private.is_platform_owner(auth.uid()));

CREATE TRIGGER trg_center_applications_updated BEFORE UPDATE ON public.center_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_center_applications_status ON public.center_applications(status, created_at DESC);