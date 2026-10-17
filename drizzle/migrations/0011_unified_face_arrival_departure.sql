CREATE TABLE public.staff_face_templates (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 descriptors jsonb NOT NULL, image_url text NOT NULL, model_version text NOT NULL DEFAULT 'face-api-1.7.15',
 consent_confirmed_by uuid NOT NULL, consent_confirmed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.staff_face_templates TO authenticated;
GRANT ALL ON public.staff_face_templates TO service_role;
ALTER TABLE public.staff_face_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff biometric managers" ON public.staff_face_templates FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'director')) WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'director'));
CREATE TABLE public.face_presence_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
 user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE, direction text NOT NULL CHECK(direction IN ('in','out')),
 status text NOT NULL, match_distance double precision NOT NULL, attendance_result text, created_at timestamptz NOT NULL DEFAULT now(),
 recorded_by uuid NOT NULL, CHECK ((student_id IS NULL) <> (user_id IS NULL))
);
GRANT SELECT, INSERT ON public.face_presence_events TO authenticated;
GRANT ALL ON public.face_presence_events TO service_role;
ALTER TABLE public.face_presence_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read presence" ON public.face_presence_events FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'director'));
CREATE INDEX face_presence_student_latest ON public.face_presence_events(student_id,created_at DESC);
CREATE INDEX face_presence_staff_latest ON public.face_presence_events(user_id,created_at DESC);
CREATE OR REPLACE FUNCTION public.save_staff_biometric_enrollment(p_user_id uuid,p_image text,p_descriptors jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'director')) THEN RAISE EXCEPTION 'Permission denied'; END IF;
 IF jsonb_typeof(p_descriptors)<>'array' OR jsonb_array_length(p_descriptors)<>3 THEN RAISE EXCEPTION 'Three samples required'; END IF;
 INSERT INTO public.staff_face_templates(user_id,descriptors,image_url,consent_confirmed_by) VALUES(p_user_id,p_descriptors,p_image,auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.save_staff_biometric_enrollment(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_staff_biometric_enrollment(uuid,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.record_face_presence(p_person_id uuid,p_kind text,p_direction text,p_score double precision) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE last_event public.face_presence_events; result_status text:='allowed'; att_result text; c public.student_face_checkins; l_id uuid; local_now timestamp:=now() AT TIME ZONE 'Asia/Tashkent';
BEGIN
 IF NOT (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'director')) THEN RAISE EXCEPTION 'Permission denied'; END IF;
 IF p_kind NOT IN ('student','staff') OR p_direction NOT IN ('in','out') OR p_score IS NULL OR p_score<0 OR p_score>=0.48 THEN RAISE EXCEPTION 'Invalid face event'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_kind||p_person_id::text,0));
 IF p_kind='student' THEN
  IF NOT EXISTS(SELECT 1 FROM public.student_face_templates WHERE student_id=p_person_id) THEN RAISE EXCEPTION 'Face not enrolled'; END IF;
  SELECT * INTO last_event FROM public.face_presence_events WHERE student_id=p_person_id AND status='allowed' ORDER BY created_at DESC LIMIT 1;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.staff_face_templates WHERE user_id=p_person_id) THEN RAISE EXCEPTION 'Face not enrolled'; END IF;
  SELECT * INTO last_event FROM public.face_presence_events WHERE user_id=p_person_id AND status='allowed' ORDER BY created_at DESC LIMIT 1;
 END IF;
 IF last_event.direction=p_direction AND (last_event.created_at AT TIME ZONE 'Asia/Tashkent')::date=local_now::date THEN RETURN jsonb_build_object('status','duplicate','attendance_result',last_event.attendance_result); END IF;
 IF last_event.created_at>now()-interval '30 seconds' THEN RETURN jsonb_build_object('status','cooldown'); END IF;
 IF p_kind='student' AND p_direction='in' THEN
  INSERT INTO public.student_face_checkins(student_id,status,match_distance) VALUES(p_person_id,'allowed',p_score) RETURNING * INTO c;
  result_status:=c.status; att_result:=c.attendance_result;
 ELSIF p_kind='staff' AND p_direction='in' THEN
  SELECT l.id INTO l_id FROM public.lessons l JOIN public.groups g ON g.id=l.group_id WHERE g.teacher_id=p_person_id AND l.is_active AND l.day_of_week=extract(isodow from local_now)::integer AND local_now::time>=l.start_time AND local_now::time<=l.start_time+interval '10 minutes' ORDER BY l.start_time LIMIT 1;
  INSERT INTO public.teacher_checkins(user_id,method,lesson_id) VALUES(p_person_id,'face',l_id);
  att_result:=CASE WHEN l_id IS NULL THEN 'staff_arrival' ELSE 'teacher_lesson' END;
 ELSE att_result:='departure'; END IF;
 INSERT INTO public.face_presence_events(student_id,user_id,direction,status,match_distance,attendance_result,recorded_by) VALUES(CASE WHEN p_kind='student' THEN p_person_id END,CASE WHEN p_kind='staff' THEN p_person_id END,p_direction,result_status,p_score,att_result,auth.uid());
 RETURN jsonb_build_object('status',result_status,'attendance_result',att_result,'debt_amount',c.debt_amount);
END $$;
REVOKE ALL ON FUNCTION public.record_face_presence(uuid,text,text,double precision) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_face_presence(uuid,text,text,double precision) TO authenticated;