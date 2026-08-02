CREATE TABLE public.telegram_link_tokens (
  token text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('student','teacher','admin','director')),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  user_id uuid,
  label text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by_chat_id text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_link_tokens TO authenticated;
GRANT ALL ON public.telegram_link_tokens TO service_role;
ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage telegram link tokens"
ON public.telegram_link_tokens FOR ALL TO authenticated
USING (
  private.has_role(auth.uid(), 'director'::public.app_role)
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
  OR private.has_role(auth.uid(), 'teacher'::public.app_role)
)
WITH CHECK (
  private.has_role(auth.uid(), 'director'::public.app_role)
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
  OR private.has_role(auth.uid(), 'teacher'::public.app_role)
);

CREATE INDEX idx_telegram_link_tokens_expires ON public.telegram_link_tokens (expires_at);

CREATE TABLE public.staff_telegram_links (
  user_id uuid PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('teacher','admin','director')),
  full_name text,
  telegram_chat_id text NOT NULL UNIQUE,
  notifications_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_telegram_links TO authenticated;
GRANT ALL ON public.staff_telegram_links TO service_role;
ALTER TABLE public.staff_telegram_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff admins manage staff telegram links"
ON public.staff_telegram_links FOR ALL TO authenticated
USING (
  private.has_role(auth.uid(), 'director'::public.app_role)
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  private.has_role(auth.uid(), 'director'::public.app_role)
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Users can view own staff telegram link"
ON public.staff_telegram_links FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER set_staff_telegram_links_updated_at
BEFORE UPDATE ON public.staff_telegram_links
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();