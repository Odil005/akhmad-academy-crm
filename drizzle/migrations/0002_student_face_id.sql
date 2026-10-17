CREATE TABLE public.student_face_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE UNIQUE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_face_enrollments TO authenticated;
GRANT ALL ON public.student_face_enrollments TO service_role;
ALTER TABLE public.student_face_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage student faces" ON public.student_face_enrollments FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'director'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'director'::app_role));

CREATE TABLE public.face_access_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  granted_by UUID,
  reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.face_access_overrides TO authenticated;
GRANT ALL ON public.face_access_overrides TO service_role;
ALTER TABLE public.face_access_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage face overrides" ON public.face_access_overrides FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'director'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'director'::app_role));

CREATE INDEX idx_face_overrides_student ON public.face_access_overrides(student_id, expires_at);