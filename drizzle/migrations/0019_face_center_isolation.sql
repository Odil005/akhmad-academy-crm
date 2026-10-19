INSERT INTO public.user_centers (user_id, center_id)
SELECT DISTINCT r.user_id, c.id FROM public.user_roles r
CROSS JOIN (SELECT id FROM public.centers WHERE is_flagship ORDER BY created_at LIMIT 1) c
WHERE NOT EXISTS (SELECT 1 FROM public.user_centers u WHERE u.user_id = r.user_id);

ALTER TABLE public.student_face_templates ADD COLUMN IF NOT EXISTS center_id uuid REFERENCES public.centers(id);
ALTER TABLE public.staff_face_templates ADD COLUMN IF NOT EXISTS center_id uuid REFERENCES public.centers(id);
ALTER TABLE public.student_face_checkins ADD COLUMN IF NOT EXISTS center_id uuid REFERENCES public.centers(id);
ALTER TABLE public.face_presence_events ADD COLUMN IF NOT EXISTS center_id uuid REFERENCES public.centers(id);
ALTER TABLE public.face_access_overrides ADD COLUMN IF NOT EXISTS center_id uuid REFERENCES public.centers(id);

UPDATE public.student_face_templates t SET center_id = s.center_id FROM public.students s WHERE s.id = t.student_id AND t.center_id IS NULL;
UPDATE public.student_face_checkins t SET center_id = s.center_id FROM public.students s WHERE s.id = t.student_id AND t.center_id IS NULL;
UPDATE public.face_access_overrides t SET center_id = s.center_id FROM public.students s WHERE s.id = t.student_id AND t.center_id IS NULL;
UPDATE public.staff_face_templates t SET center_id = private.current_center(t.user_id) WHERE t.center_id IS NULL;
UPDATE public.face_presence_events t SET center_id = (SELECT id FROM public.centers WHERE is_flagship ORDER BY created_at LIMIT 1) WHERE t.center_id IS NULL;

CREATE OR REPLACE FUNCTION public.set_face_center_id() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.center_id IS NULL THEN
    IF TG_TABLE_NAME IN ('student_face_templates','student_face_checkins','face_access_overrides') THEN
      NEW.center_id := (SELECT center_id FROM public.students WHERE id = NEW.student_id);
    ELSIF TG_TABLE_NAME = 'staff_face_templates' THEN
      NEW.center_id := private.current_center(NEW.user_id);
    END IF;
    NEW.center_id := COALESCE(NEW.center_id, private.current_center(), (SELECT id FROM public.centers ORDER BY created_at LIMIT 1));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_student_face_templates_center BEFORE INSERT OR UPDATE ON public.student_face_templates FOR EACH ROW EXECUTE FUNCTION public.set_face_center_id();
CREATE TRIGGER trg_staff_face_templates_center BEFORE INSERT OR UPDATE ON public.staff_face_templates FOR EACH ROW EXECUTE FUNCTION public.set_face_center_id();
CREATE TRIGGER trg_student_face_checkins_center BEFORE INSERT ON public.student_face_checkins FOR EACH ROW EXECUTE FUNCTION public.set_face_center_id();
CREATE TRIGGER trg_face_presence_events_center BEFORE INSERT ON public.face_presence_events FOR EACH ROW EXECUTE FUNCTION public.set_face_center_id();
CREATE TRIGGER trg_face_access_overrides_center BEFORE INSERT ON public.face_access_overrides FOR EACH ROW EXECUTE FUNCTION public.set_face_center_id();

CREATE INDEX IF NOT EXISTS student_face_templates_center_idx ON public.student_face_templates(center_id);
CREATE INDEX IF NOT EXISTS staff_face_templates_center_idx ON public.staff_face_templates(center_id);

CREATE POLICY face_student_templates_own_center ON public.student_face_templates AS RESTRICTIVE FOR ALL TO authenticated
  USING (center_id IS NULL OR center_id = private.current_center()) WITH CHECK (center_id IS NULL OR center_id = private.current_center());
CREATE POLICY face_staff_templates_own_center ON public.staff_face_templates AS RESTRICTIVE FOR ALL TO authenticated
  USING (center_id IS NULL OR center_id = private.current_center()) WITH CHECK (center_id IS NULL OR center_id = private.current_center());
CREATE POLICY face_checkins_own_center ON public.student_face_checkins AS RESTRICTIVE FOR ALL TO authenticated
  USING (center_id IS NULL OR center_id = private.current_center()) WITH CHECK (center_id IS NULL OR center_id = private.current_center());
CREATE POLICY face_presence_own_center ON public.face_presence_events AS RESTRICTIVE FOR ALL TO authenticated
  USING (center_id IS NULL OR center_id = private.current_center()) WITH CHECK (center_id IS NULL OR center_id = private.current_center());
CREATE POLICY face_overrides_own_center ON public.face_access_overrides AS RESTRICTIVE FOR ALL TO authenticated
  USING (center_id IS NULL OR center_id = private.current_center()) WITH CHECK (center_id IS NULL OR center_id = private.current_center());