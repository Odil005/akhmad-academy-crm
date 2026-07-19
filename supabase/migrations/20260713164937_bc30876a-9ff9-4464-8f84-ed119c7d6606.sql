
-- 1. Leads: allow director alongside admin
DROP POLICY IF EXISTS "admins can read leads" ON public.leads;
DROP POLICY IF EXISTS "admins can update leads" ON public.leads;
DROP POLICY IF EXISTS "admins can delete leads" ON public.leads;

CREATE POLICY "staff can read leads" ON public.leads FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));
CREATE POLICY "staff can update leads" ON public.leads FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));
CREATE POLICY "staff can delete leads" ON public.leads FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- 2. Settings: replace key-name matching with explicit is_public flag
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
UPDATE public.settings SET is_public = true WHERE key IN ('contact_info', 'homepage_stats');

DROP POLICY IF EXISTS "settings: public read contact_info" ON public.settings;
DROP POLICY IF EXISTS "settings: public read homepage_stats" ON public.settings;

CREATE POLICY "settings: public read flagged" ON public.settings FOR SELECT
  USING (is_public = true);

-- Only director can toggle is_public (admin write policy already restricts scope but keep is_public director-only)
CREATE OR REPLACE FUNCTION public.settings_guard_is_public()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.is_public IS DISTINCT FROM OLD.is_public)
     OR (TG_OP = 'INSERT' AND NEW.is_public = true) THEN
    IF NOT has_role(auth.uid(), 'director'::app_role) THEN
      RAISE EXCEPTION 'Only director can change public visibility of settings';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS settings_guard_is_public_trg ON public.settings;
CREATE TRIGGER settings_guard_is_public_trg BEFORE INSERT OR UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.settings_guard_is_public();

-- 3. Parent link tokens for Telegram bot
CREATE TABLE public.parent_link_tokens (
  token text PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by_chat_id text
);
CREATE INDEX idx_parent_link_tokens_student ON public.parent_link_tokens(student_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_link_tokens TO authenticated;
GRANT ALL ON public.parent_link_tokens TO service_role;

ALTER TABLE public.parent_link_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent_link_tokens: staff manage" ON public.parent_link_tokens
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));
