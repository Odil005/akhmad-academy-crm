-- Private course videos: teachers upload only to their own folder; students can
-- read only videos published for one of their active groups.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('course-videos', 'course-videos', false, 524288000, ARRAY['video/mp4', 'video/webm', 'video/quicktime'])
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.video_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) <= 160),
  description text,
  storage_path text NOT NULL UNIQUE,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS video_lessons_group_created_idx ON public.video_lessons (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_lessons_teacher_created_idx ON public.video_lessons (teacher_user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_lessons TO authenticated;
ALTER TABLE public.video_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video lessons teacher manage own" ON public.video_lessons FOR ALL TO authenticated
USING (teacher_user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'director'::public.app_role))
WITH CHECK (teacher_user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'director'::public.app_role));
CREATE POLICY "video lessons students read enrolled" ON public.video_lessons FOR SELECT TO authenticated
USING (published AND EXISTS (
  SELECT 1 FROM public.students s WHERE s.profile_id = auth.uid() AND s.group_id = video_lessons.group_id
) OR published AND EXISTS (
  SELECT 1 FROM public.student_enrollments e JOIN public.students s ON s.id = e.student_id
  WHERE s.profile_id = auth.uid() AND e.group_id = video_lessons.group_id AND e.status = 'active'
));

CREATE POLICY "course videos teacher upload own folder" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'course-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "course videos teacher delete own folder" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'course-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "course videos enrolled users read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'course-videos' AND EXISTS (
  SELECT 1 FROM public.video_lessons v WHERE v.storage_path = name AND (
    v.teacher_user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'director'::public.app_role) OR
    (v.published AND EXISTS (SELECT 1 FROM public.students s WHERE s.profile_id = auth.uid() AND s.group_id = v.group_id)) OR
    (v.published AND EXISTS (SELECT 1 FROM public.student_enrollments e JOIN public.students s ON s.id = e.student_id WHERE s.profile_id = auth.uid() AND e.group_id = v.group_id AND e.status = 'active'))
  )
));
