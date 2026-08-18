-- Onboarding progress per user
CREATE TABLE public.onboarding_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student',
  tour_key TEXT NOT NULL DEFAULT 'main',
  last_step INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  done_tasks TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tour_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_progress TO authenticated;
GRANT ALL ON public.onboarding_progress TO service_role;
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_own_all" ON public.onboarding_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Guide videos (video qo'llanma)
CREATE TABLE public.guide_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  target_role TEXT NOT NULL DEFAULT 'admin',
  video_url TEXT,
  storage_path TEXT,
  duration_seconds INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX guide_videos_role_position_idx ON public.guide_videos (target_role, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guide_videos TO authenticated;
GRANT ALL ON public.guide_videos TO service_role;
ALTER TABLE public.guide_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guide_videos_read" ON public.guide_videos
  FOR SELECT TO authenticated
  USING (published OR private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director'));

CREATE POLICY "guide_videos_manage" ON public.guide_videos
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'director'));

-- Watch tracking
CREATE TABLE public.guide_video_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.guide_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (video_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guide_video_views TO authenticated;
GRANT ALL ON public.guide_video_views TO service_role;
ALTER TABLE public.guide_video_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guide_views_own_all" ON public.guide_video_views
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());