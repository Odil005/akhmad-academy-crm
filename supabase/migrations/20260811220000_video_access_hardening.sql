-- Harden video lessons: a teacher may work only with videos for a group that
-- is currently assigned to that teacher.  Access is enforced in the database,
-- not merely by the panel's group dropdown.

DROP POLICY IF EXISTS "video lessons teacher manage own" ON public.video_lessons;
DROP POLICY IF EXISTS "video lessons students read enrolled" ON public.video_lessons;

-- Administrators and directors retain operational control for moderation and
-- recovery.  Teachers and students receive narrower policies below.
CREATE POLICY "video lessons staff manage"
ON public.video_lessons FOR ALL TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR private.has_role(auth.uid(), 'director'::public.app_role)
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR private.has_role(auth.uid(), 'director'::public.app_role)
);

CREATE POLICY "video lessons teacher manage assigned groups"
ON public.video_lessons FOR ALL TO authenticated
USING (
  private.has_role(auth.uid(), 'teacher'::public.app_role)
  AND teacher_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = video_lessons.group_id
      AND g.teacher_id = auth.uid()
  )
)
WITH CHECK (
  private.has_role(auth.uid(), 'teacher'::public.app_role)
  AND teacher_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = video_lessons.group_id
      AND g.teacher_id = auth.uid()
  )
);

CREATE POLICY "video lessons students read active enrollment"
ON public.video_lessons FOR SELECT TO authenticated
USING (
  published
  AND private.has_role(auth.uid(), 'student'::public.app_role)
  AND (
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.profile_id = auth.uid()
        AND s.group_id = video_lessons.group_id
        AND s.status_enum IN ('active'::public.student_status, 'trial'::public.student_status)
    )
    OR EXISTS (
      SELECT 1
      FROM public.student_enrollments e
      JOIN public.students s ON s.id = e.student_id
      WHERE s.profile_id = auth.uid()
        AND e.group_id = video_lessons.group_id
        AND e.status IN ('active', 'trial')
        AND (e.ended_at IS NULL OR e.ended_at >= CURRENT_DATE)
    )
  )
);

-- Storage uploads happen before the corresponding video_lessons row is
-- inserted, so group membership cannot safely be checked here.  Restrict the
-- temporary object to a teacher's own folder; the table policy above validates
-- the actual group before a video can become visible.
DROP POLICY IF EXISTS "course videos teacher upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "course videos teacher delete own folder" ON storage.objects;
DROP POLICY IF EXISTS "course videos enrolled users read" ON storage.objects;

CREATE POLICY "course videos staff manage objects"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'course-videos'
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'director'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'course-videos'
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'director'::public.app_role)
  )
);

CREATE POLICY "course videos teacher upload own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'course-videos'
  AND private.has_role(auth.uid(), 'teacher'::public.app_role)
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "course videos teacher update own folder"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'course-videos'
  AND private.has_role(auth.uid(), 'teacher'::public.app_role)
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'course-videos'
  AND private.has_role(auth.uid(), 'teacher'::public.app_role)
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- The current UI removes the database record before its storage object.  Keep
-- a teacher's cleanup permission scoped to that teacher's folder so a failed
-- database write never leaves an undeletable orphaned upload.
CREATE POLICY "course videos teacher delete own folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'course-videos'
  AND private.has_role(auth.uid(), 'teacher'::public.app_role)
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "course videos authorized read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-videos'
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'director'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.video_lessons v
      WHERE v.storage_path = name
        AND (
          (
            private.has_role(auth.uid(), 'teacher'::public.app_role)
            AND v.teacher_user_id = auth.uid()
            AND EXISTS (
              SELECT 1
              FROM public.groups g
              WHERE g.id = v.group_id
                AND g.teacher_id = auth.uid()
            )
          )
          OR (
            v.published
            AND private.has_role(auth.uid(), 'student'::public.app_role)
            AND (
              EXISTS (
                SELECT 1
                FROM public.students s
                WHERE s.profile_id = auth.uid()
                  AND s.group_id = v.group_id
                  AND s.status_enum IN ('active'::public.student_status, 'trial'::public.student_status)
              )
              OR EXISTS (
                SELECT 1
                FROM public.student_enrollments e
                JOIN public.students s ON s.id = e.student_id
                WHERE s.profile_id = auth.uid()
                  AND e.group_id = v.group_id
                  AND e.status IN ('active', 'trial')
                  AND (e.ended_at IS NULL OR e.ended_at >= CURRENT_DATE)
              )
            )
          )
        )
    )
  )
);
