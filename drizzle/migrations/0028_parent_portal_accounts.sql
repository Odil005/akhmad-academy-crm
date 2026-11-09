ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'parent';

-- One-time sign-in codes sent by the Telegram bot to the chat linked to a parent phone.
CREATE TABLE IF NOT EXISTS public.parent_login_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS parent_login_codes_phone_idx ON public.parent_login_codes (phone, created_at DESC);
GRANT ALL ON public.parent_login_codes TO service_role;
ALTER TABLE public.parent_login_codes ENABLE ROW LEVEL SECURITY;
-- No policies: only the server (service role) reads or writes codes.

-- A parent's sign-in account, keyed by the verified phone (last 9 digits).
CREATE TABLE IF NOT EXISTS public.parent_accounts (
  user_id uuid PRIMARY KEY,
  phone text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
GRANT SELECT ON public.parent_accounts TO authenticated;
GRANT ALL ON public.parent_accounts TO service_role;
ALTER TABLE public.parent_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parent reads own account" ON public.parent_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());