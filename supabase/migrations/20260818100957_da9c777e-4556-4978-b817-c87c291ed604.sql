-- Teachers upload/manage their own video files; staff manage all.
CREATE POLICY "course_videos_staff_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'course-videos' AND (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director')))
  WITH CHECK (bucket_id = 'course-videos' AND (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director')));

CREATE POLICY "course_videos_teacher_own" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'course-videos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'course-videos' AND (storage.foldername(name))[1] = auth.uid()::text
              AND private.has_role(auth.uid(), 'teacher'));

-- Students read files of published lessons for their own groups.
CREATE POLICY "course_videos_student_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'course-videos' AND EXISTS (
    SELECT 1 FROM public.video_lessons v
     WHERE v.storage_path = storage.objects.name
       AND v.published
       AND v.group_id IN (SELECT group_id FROM private.student_group_ids(auth.uid()))
  ));