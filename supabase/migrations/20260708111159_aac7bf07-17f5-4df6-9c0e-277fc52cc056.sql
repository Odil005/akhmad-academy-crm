
-- Calls (IP telephony log)
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  phone TEXT NOT NULL,
  contact_type TEXT CHECK (contact_type IN ('student','teacher','lead','other')),
  contact_id UUID,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','missed','busy','failed','no_answer')),
  recording_url TEXT,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage calls" ON public.calls FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_calls_updated BEFORE UPDATE ON public.calls FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_calls_called_at ON public.calls (called_at DESC);

-- Teacher Face ID enrollment
CREATE TABLE public.teacher_face_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  descriptor JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_face_enrollments TO authenticated;
GRANT ALL ON public.teacher_face_enrollments TO service_role;
ALTER TABLE public.teacher_face_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher manages own face" ON public.teacher_face_enrollments FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_face_updated BEFORE UPDATE ON public.teacher_face_enrollments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Teacher check-ins
CREATE TABLE public.teacher_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method TEXT NOT NULL DEFAULT 'face' CHECK (method IN ('face','password','manual')),
  photo_url TEXT,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_checkins TO authenticated;
GRANT ALL ON public.teacher_checkins TO service_role;
ALTER TABLE public.teacher_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher own checkins" ON public.teacher_checkins FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_checkins_user_time ON public.teacher_checkins (user_id, checked_in_at DESC);
