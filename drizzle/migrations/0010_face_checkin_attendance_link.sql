ALTER TABLE public.student_face_checkins ADD COLUMN attendance_id uuid REFERENCES public.attendance(id) ON DELETE SET NULL;
ALTER TABLE public.student_face_checkins ADD COLUMN lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL;
ALTER TABLE public.student_face_checkins ADD COLUMN attendance_result text;

CREATE OR REPLACE FUNCTION public.face_lesson_is_current(p_day integer, p_start time, p_end time, p_active boolean, p_status text, p_started date, p_ended date, p_local timestamp) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT coalesce(p_active AND p_status='active' AND p_started<=p_local::date AND (p_ended IS NULL OR p_ended>=p_local::date) AND p_day=extract(isodow from p_local)::integer AND p_start<=p_local::time AND p_local::time<p_end,false)
$$;
GRANT EXECUTE ON FUNCTION public.face_lesson_is_current(integer,time,time,boolean,text,date,date,timestamp) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.link_student_face_attendance() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE local_now timestamp := NEW.created_at AT TIME ZONE 'Asia/Tashkent'; candidates uuid[]; chosen uuid; att_id uuid; existing_status text;
BEGIN
 NEW.attendance_id := NULL; NEW.lesson_id := NULL;
 IF NEW.status <> 'allowed' THEN NEW.attendance_result := 'blocked'; RETURN NEW; END IF;
 IF NEW.match_distance IS NULL OR NEW.match_distance < 0 OR NEW.match_distance >= 0.48 THEN NEW.attendance_result := 'unverified'; RETURN NEW; END IF;
 SELECT array_agg(l.id ORDER BY l.id) INTO candidates FROM public.lessons l
 WHERE EXISTS (SELECT 1 FROM public.student_enrollments e WHERE e.student_id=NEW.student_id AND e.group_id=l.group_id AND public.face_lesson_is_current(l.day_of_week,l.start_time,l.end_time,l.is_active,e.status,e.started_at,e.ended_at,local_now));
 IF coalesce(cardinality(candidates),0)=0 THEN NEW.attendance_result := 'no_lesson'; RETURN NEW; END IF;
 IF cardinality(candidates)>1 THEN NEW.attendance_result := 'ambiguous'; RETURN NEW; END IF;
 chosen := candidates[1]; NEW.lesson_id := chosen;
 INSERT INTO public.attendance(lesson_id,student_id,date,status,marked_by,center_id)
 SELECT chosen,NEW.student_id,local_now::date,'present',auth.uid(),l.center_id FROM public.lessons l WHERE l.id=chosen
 ON CONFLICT (lesson_id,student_id,date) DO NOTHING RETURNING id INTO att_id;
 IF att_id IS NOT NULL THEN NEW.attendance_result := 'recorded';
 ELSE
 SELECT id,status INTO att_id,existing_status FROM public.attendance WHERE lesson_id=chosen AND student_id=NEW.student_id AND date=local_now::date;
 NEW.attendance_result := CASE WHEN existing_status IN ('present','late') THEN 'already_recorded' ELSE 'manual_review' END;
 END IF;
 NEW.attendance_id := att_id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.link_student_face_attendance() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER zz_link_student_face_attendance BEFORE INSERT ON public.student_face_checkins FOR EACH ROW EXECUTE FUNCTION public.link_student_face_attendance();