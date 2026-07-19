
CREATE TABLE public.director_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  director_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.director_credentials TO authenticated;
GRANT ALL ON public.director_credentials TO service_role;
ALTER TABLE public.director_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dc: self read" ON public.director_credentials FOR SELECT TO authenticated
USING (director_user_id = auth.uid());
