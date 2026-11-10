CREATE TABLE public.student_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid REFERENCES public.centers(id),
  telegram_user_id bigint NOT NULL UNIQUE,
  telegram_chat_id text NOT NULL,
  telegram_username text,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student','parent')),
  first_name text NOT NULL,
  last_name text,
  phone text,
  subject text,
  auth_user_id uuid,
  username text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  decided_by uuid,
  decided_at timestamptz,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_student_applications_status ON public.student_applications(status, created_at DESC);
GRANT SELECT, UPDATE ON public.student_applications TO authenticated;
GRANT ALL ON public.student_applications TO service_role;
ALTER TABLE public.student_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read applications" ON public.student_applications FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'director'));
CREATE POLICY "applicant reads own" ON public.student_applications FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());
CREATE POLICY "staff update applications" ON public.student_applications FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'director'));
CREATE POLICY applications_center_isolation ON public.student_applications AS RESTRICTIVE FOR ALL TO authenticated
  USING (center_id IS NULL OR center_id = private.current_center() OR private.is_platform_owner() OR auth_user_id = auth.uid());
CREATE TRIGGER trg_student_applications_set_center BEFORE INSERT ON public.student_applications FOR EACH ROW EXECUTE FUNCTION public.set_center_id();
CREATE TRIGGER trg_student_applications_updated BEFORE UPDATE ON public.student_applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();