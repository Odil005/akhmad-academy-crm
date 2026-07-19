
-- 1) Teacher level enum + column
DO $$ BEGIN
  CREATE TYPE public.teacher_level AS ENUM ('junior','middle','senior','lead');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS teacher_level public.teacher_level;

-- 2) Insert new subjects (idempotent)
INSERT INTO public.subjects (name)
SELECT v FROM (VALUES ('SAT'), ('Ona tili va Adabiyot')) AS t(v)
WHERE NOT EXISTS (SELECT 1 FROM public.subjects s WHERE lower(s.name) = lower(t.v));

-- 3) Allow staff to read all user_roles (needed to list teachers)
DROP POLICY IF EXISTS "Roles: staff read all" ON public.user_roles;
CREATE POLICY "Roles: staff read all" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'admin'));

-- 4) Allow staff to update teacher_level on any profile
DROP POLICY IF EXISTS "Profiles: staff update all" ON public.profiles;
CREATE POLICY "Profiles: staff update all" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'admin'));
