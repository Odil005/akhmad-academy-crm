CREATE TABLE public.student_face_templates (
 student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
 descriptors jsonb NOT NULL,
 model_version text NOT NULL DEFAULT 'face-api-1.7.15',
 consent_confirmed_by uuid NOT NULL,
 consent_confirmed_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_face_templates TO authenticated;
GRANT ALL ON public.student_face_templates TO service_role;
ALTER TABLE public.student_face_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage biometric templates" ON public.student_face_templates FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'director'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'director'::public.app_role));
ALTER TABLE public.student_face_checkins ADD COLUMN match_distance double precision;
CREATE OR REPLACE FUNCTION public.enforce_student_face_access() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE overdue numeric; permitted boolean;
BEGIN
 SELECT coalesce(sum(greatest(amount-coalesce(paid_amount,0),0)),0) INTO overdue FROM public.payments WHERE student_id=NEW.student_id AND status='pending' AND due_date < (now() AT TIME ZONE 'Asia/Tashkent')::date;
 SELECT EXISTS(SELECT 1 FROM public.face_access_overrides WHERE student_id=NEW.student_id AND expires_at > now()) INTO permitted;
 NEW.debt_amount := overdue;
 IF overdue > 0 AND NOT permitted THEN NEW.status := 'blocked'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_student_face_access() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_student_face_access BEFORE INSERT ON public.student_face_checkins FOR EACH ROW EXECUTE FUNCTION public.enforce_student_face_access();