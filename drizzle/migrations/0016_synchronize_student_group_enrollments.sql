CREATE OR REPLACE FUNCTION public.sync_student_primary_enrollment() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE g public.groups%ROWTYPE;
BEGIN
 IF NEW.group_id IS NULL OR NEW.status NOT IN ('active','trial') THEN RETURN NEW; END IF;
 SELECT * INTO g FROM public.groups WHERE id=NEW.group_id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 INSERT INTO public.student_enrollments(student_id,group_id,subject_id,teacher_user_id,monthly_fee,started_at,status,center_id)
 VALUES(NEW.id,g.id,g.subject_id,g.teacher_id,CASE WHEN NEW.monthly_fee>0 THEN NEW.monthly_fee ELSE g.monthly_fee END,COALESCE(NEW.start_date,CURRENT_DATE),NEW.status,NEW.center_id)
 ON CONFLICT(student_id,group_id) DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_student_primary_enrollment AFTER INSERT OR UPDATE OF group_id ON public.students FOR EACH ROW EXECUTE FUNCTION public.sync_student_primary_enrollment();
CREATE OR REPLACE FUNCTION public.sync_active_group_metadata() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 UPDATE public.student_enrollments SET subject_id=NEW.subject_id,teacher_user_id=NEW.teacher_id WHERE group_id=NEW.id AND status IN ('active','trial') AND ended_at IS NULL;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_active_group_metadata AFTER UPDATE OF subject_id,teacher_id ON public.groups FOR EACH ROW EXECUTE FUNCTION public.sync_active_group_metadata();