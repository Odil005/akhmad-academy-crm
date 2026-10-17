CREATE OR REPLACE FUNCTION public.face_presence_repeat_status(p_last_direction text,p_direction text,p_last_at timestamptz,p_now timestamptz) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN p_last_direction=p_direction AND (p_last_at AT TIME ZONE 'Asia/Tashkent')::date=(p_now AT TIME ZONE 'Asia/Tashkent')::date THEN 'duplicate' WHEN p_last_at>p_now-interval '30 seconds' THEN 'cooldown' ELSE 'new' END
$$;
GRANT EXECUTE ON FUNCTION public.face_presence_repeat_status(text,text,timestamptz,timestamptz) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.guard_face_presence_repeats() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE previous public.face_presence_events; repeat_status text;
BEGIN
 SELECT * INTO previous FROM public.face_presence_events WHERE status='allowed' AND ((NEW.student_id IS NOT NULL AND student_id=NEW.student_id) OR (NEW.user_id IS NOT NULL AND user_id=NEW.user_id)) ORDER BY created_at DESC LIMIT 1;
 repeat_status:=public.face_presence_repeat_status(previous.direction,NEW.direction,previous.created_at,NEW.created_at);
 IF repeat_status<>'new' THEN RAISE EXCEPTION 'Repeated face presence: %',repeat_status; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_presence_repeats BEFORE INSERT ON public.face_presence_events FOR EACH ROW EXECUTE FUNCTION public.guard_face_presence_repeats();