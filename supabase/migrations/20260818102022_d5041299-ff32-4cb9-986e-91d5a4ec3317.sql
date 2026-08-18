-- Geo data for Face ID check-ins
ALTER TABLE public.teacher_checkins
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS accuracy_m double precision,
  ADD COLUMN IF NOT EXISTS location_name text,
  ADD COLUMN IF NOT EXISTS distance_m double precision,
  ADD COLUMN IF NOT EXISTS within_zone boolean;

-- Allowed campus locations for check-in
CREATE TABLE IF NOT EXISTS public.checkin_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_m integer NOT NULL DEFAULT 150,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkin_locations TO authenticated;
GRANT ALL ON public.checkin_locations TO service_role;
ALTER TABLE public.checkin_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY checkin_locations_read ON public.checkin_locations FOR SELECT TO authenticated
  USING (true);
CREATE POLICY checkin_locations_staff_write ON public.checkin_locations FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director'));

CREATE TRIGGER trg_checkin_locations_updated BEFORE UPDATE ON public.checkin_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();