-- Schedule is the single source of truth. These rules protect it even when
-- concurrent users, imports, or direct API calls bypass the browser preview.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION public.lock_lesson_resources(
  p_group_id uuid,
  p_teacher_user_id uuid,
  p_room_id uuid,
  p_day_of_week smallint
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  resource_lock bigint;
BEGIN
  -- Acquire locks in a deterministic order, preventing two simultaneous saves
  -- from creating an overlap between the time check and the insert.
  FOR resource_lock IN
    SELECT lock_key
    FROM (
      VALUES
        (hashtextextended(format('schedule:group:%s:%s', p_group_id, p_day_of_week), 0)),
        (
          CASE WHEN p_teacher_user_id IS NULL THEN NULL::bigint
          ELSE hashtextextended(format('schedule:teacher:%s:%s', p_teacher_user_id, p_day_of_week), 0)
          END
        ),
        (
          CASE WHEN p_room_id IS NULL THEN NULL::bigint
          ELSE hashtextextended(format('schedule:room:%s:%s', p_room_id, p_day_of_week), 0)
          END
        )
    ) AS locks(lock_key)
    WHERE lock_key IS NOT NULL
    ORDER BY lock_key
  LOOP
    PERFORM pg_advisory_xact_lock(resource_lock);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_lesson_schedule_conflicts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Archived lessons do not reserve teachers, rooms, or groups.
  IF NOT NEW.is_active THEN
    RETURN NEW;
  END IF;

  PERFORM public.lock_lesson_resources(
    NEW.group_id,
    NEW.teacher_user_id,
    NEW.room_id,
    NEW.day_of_week
  );

  IF EXISTS (
    SELECT 1
    FROM public.lessons existing
    WHERE existing.is_active
      AND existing.id IS DISTINCT FROM NEW.id
      AND existing.day_of_week = NEW.day_of_week
      AND existing.group_id = NEW.group_id
      AND existing.start_time < NEW.end_time
      AND NEW.start_time < existing.end_time
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = 'Jadval konflikti: bu guruhning tanlangan vaqtda boshqa darsi bor.';
  END IF;

  IF NEW.teacher_user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.lessons existing
    WHERE existing.is_active
      AND existing.id IS DISTINCT FROM NEW.id
      AND existing.day_of_week = NEW.day_of_week
      AND existing.teacher_user_id = NEW.teacher_user_id
      AND existing.start_time < NEW.end_time
      AND NEW.start_time < existing.end_time
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = 'Jadval konflikti: o''qituvchi tanlangan vaqtda band.';
  END IF;

  IF NEW.room_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.lessons existing
    WHERE existing.is_active
      AND existing.id IS DISTINCT FROM NEW.id
      AND existing.day_of_week = NEW.day_of_week
      AND existing.room_id = NEW.room_id
      AND existing.start_time < NEW.end_time
      AND NEW.start_time < existing.end_time
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = 'Jadval konflikti: xona tanlangan vaqtda band.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_lesson_schedule_conflicts ON public.lessons;
CREATE TRIGGER trg_enforce_lesson_schedule_conflicts
BEFORE INSERT OR UPDATE ON public.lessons
FOR EACH ROW EXECUTE FUNCTION public.enforce_lesson_schedule_conflicts();

-- Existing installations may contain legacy overlaps. The trigger above still
-- protects every new change; the stronger GiST constraints are added whenever
-- the current data is already clean.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.lessons left_lesson
    JOIN public.lessons right_lesson
      ON left_lesson.id < right_lesson.id
      AND left_lesson.is_active
      AND right_lesson.is_active
      AND left_lesson.day_of_week = right_lesson.day_of_week
      AND left_lesson.start_time < right_lesson.end_time
      AND right_lesson.start_time < left_lesson.end_time
      AND (
        left_lesson.group_id = right_lesson.group_id
        OR (
          left_lesson.teacher_user_id IS NOT NULL
          AND left_lesson.teacher_user_id = right_lesson.teacher_user_id
        )
        OR (
          left_lesson.room_id IS NOT NULL
          AND left_lesson.room_id = right_lesson.room_id
        )
      )
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.lessons'::regclass AND conname = 'lessons_active_group_no_overlap'
    ) THEN
      EXECUTE 'ALTER TABLE public.lessons ADD CONSTRAINT lessons_active_group_no_overlap
        EXCLUDE USING gist (
          group_id WITH =,
          day_of_week WITH =,
          int4range(EXTRACT(EPOCH FROM start_time)::integer, EXTRACT(EPOCH FROM end_time)::integer, ''[)'') WITH &&
        ) WHERE (is_active)';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.lessons'::regclass AND conname = 'lessons_active_teacher_no_overlap'
    ) THEN
      EXECUTE 'ALTER TABLE public.lessons ADD CONSTRAINT lessons_active_teacher_no_overlap
        EXCLUDE USING gist (
          teacher_user_id WITH =,
          day_of_week WITH =,
          int4range(EXTRACT(EPOCH FROM start_time)::integer, EXTRACT(EPOCH FROM end_time)::integer, ''[)'') WITH &&
        ) WHERE (is_active AND teacher_user_id IS NOT NULL)';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.lessons'::regclass AND conname = 'lessons_active_room_no_overlap'
    ) THEN
      EXECUTE 'ALTER TABLE public.lessons ADD CONSTRAINT lessons_active_room_no_overlap
        EXCLUDE USING gist (
          room_id WITH =,
          day_of_week WITH =,
          int4range(EXTRACT(EPOCH FROM start_time)::integer, EXTRACT(EPOCH FROM end_time)::integer, ''[)'') WITH &&
        ) WHERE (is_active AND room_id IS NOT NULL)';
    END IF;
  ELSE
    RAISE NOTICE 'Legacy schedule conflicts found: resolve them in Dars jadvali. New conflicts are blocked by trg_enforce_lesson_schedule_conflicts.';
  END IF;
END;
$migration$;

-- Schedules are historical records. Rooms are deactivated instead of deleted,
-- so old lessons never lose their room assignment.
CREATE OR REPLACE FUNCTION public.prevent_room_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'Xonani o''chirish mumkin emas. Uni faolsiz holatga o''tkazing.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_room_delete ON public.rooms;
CREATE TRIGGER trg_prevent_room_delete
BEFORE DELETE ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.prevent_room_delete();
