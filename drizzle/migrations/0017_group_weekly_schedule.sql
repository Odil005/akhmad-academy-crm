ALTER TABLE public.groups ADD COLUMN schedule_days integer[] NOT NULL DEFAULT '{}', ADD COLUMN schedule_start time, ADD COLUMN schedule_end time;
ALTER TABLE public.lessons ADD COLUMN group_schedule_generated boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.sync_group_weekly_schedule() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE d integer;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.schedule_days IS NOT DISTINCT FROM OLD.schedule_days AND NEW.schedule_start IS NOT DISTINCT FROM OLD.schedule_start AND NEW.schedule_end IS NOT DISTINCT FROM OLD.schedule_end AND NEW.subject_id IS NOT DISTINCT FROM OLD.subject_id AND NEW.teacher_id IS NOT DISTINCT FROM OLD.teacher_id THEN RETURN NEW; END IF;
 END IF;
 IF cardinality(NEW.schedule_days)>0 AND (NEW.schedule_start IS NULL OR NEW.schedule_end IS NULL OR NEW.schedule_end<=NEW.schedule_start) THEN RAISE EXCEPTION 'Darsning boshlanish va tugash vaqtini to‘g‘ri kiriting'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(NEW.schedule_days) x WHERE x NOT BETWEEN 1 AND 7) THEN RAISE EXCEPTION 'Hafta kuni 1 dan 7 gacha bo‘lishi kerak'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('group-schedule:'||NEW.id::text,0));
 IF NEW.teacher_id IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('teacher-schedule:'||NEW.teacher_id::text,0)); END IF;
 UPDATE public.lessons SET is_active=false WHERE group_id=NEW.id AND group_schedule_generated AND is_active;
 FOR d IN SELECT DISTINCT x FROM unnest(NEW.schedule_days) x ORDER BY x LOOP
  IF EXISTS(SELECT 1 FROM public.lessons l WHERE l.is_active AND l.day_of_week=d AND l.start_time<NEW.schedule_end AND NEW.schedule_start<l.end_time AND (l.group_id=NEW.id OR (NEW.teacher_id IS NOT NULL AND l.teacher_user_id=NEW.teacher_id)) AND NOT(l.group_id=NEW.id AND l.start_time=NEW.schedule_start AND l.end_time=NEW.schedule_end AND l.subject_id IS NOT DISTINCT FROM NEW.subject_id AND l.teacher_user_id IS NOT DISTINCT FROM NEW.teacher_id)) THEN RAISE EXCEPTION 'Tanlangan vaqtda guruh yoki o‘qituvchining boshqa darsi bor'; END IF;
  IF EXISTS(SELECT 1 FROM public.lessons l WHERE l.is_active AND l.group_id=NEW.id AND l.day_of_week=d AND l.start_time=NEW.schedule_start AND l.end_time=NEW.schedule_end AND l.subject_id IS NOT DISTINCT FROM NEW.subject_id AND l.teacher_user_id IS NOT DISTINCT FROM NEW.teacher_id) THEN CONTINUE; END IF;
  UPDATE public.lessons SET is_active=true WHERE id=(SELECT id FROM public.lessons WHERE group_id=NEW.id AND group_schedule_generated AND day_of_week=d AND start_time=NEW.schedule_start AND end_time=NEW.schedule_end AND subject_id IS NOT DISTINCT FROM NEW.subject_id AND teacher_user_id IS NOT DISTINCT FROM NEW.teacher_id ORDER BY created_at DESC LIMIT 1);
  IF NOT FOUND THEN INSERT INTO public.lessons(group_id,subject_id,teacher_user_id,day_of_week,start_time,end_time,center_id,group_schedule_generated,is_active) VALUES(NEW.id,NEW.subject_id,NEW.teacher_id,d,NEW.schedule_start,NEW.schedule_end,NEW.center_id,true,true); END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_group_weekly_schedule AFTER INSERT OR UPDATE OF schedule_days,schedule_start,schedule_end,subject_id,teacher_id ON public.groups FOR EACH ROW EXECUTE FUNCTION public.sync_group_weekly_schedule();