CREATE TABLE public.student_face_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'allowed',
  debt_amount NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.student_face_checkins TO authenticated;
GRANT ALL ON public.student_face_checkins TO service_role;
ALTER TABLE public.student_face_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage student face checkins" ON public.student_face_checkins FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'director'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'director'::app_role));
CREATE INDEX idx_student_face_checkins_student ON public.student_face_checkins(student_id, created_at DESC);