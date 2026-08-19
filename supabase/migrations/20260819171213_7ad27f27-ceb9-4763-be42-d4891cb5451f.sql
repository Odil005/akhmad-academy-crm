-- ============ 1. Platform (SaaS) asosi: markazlar, egasi, tariflar, abonent ============

CREATE TABLE IF NOT EXISTS public.centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  logo_url text,
  phone text,
  address text,
  status text NOT NULL DEFAULT 'active',
  student_limit int NOT NULL DEFAULT 300,
  telegram_chat_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.centers TO authenticated;
GRANT ALL ON public.centers TO service_role;
ALTER TABLE public.centers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.platform_owners (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_owners TO authenticated;
GRANT ALL ON public.platform_owners TO service_role;
ALTER TABLE public.platform_owners ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_centers (
  user_id uuid NOT NULL,
  center_id uuid NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, center_id)
);
GRANT SELECT ON public.user_centers TO authenticated;
GRANT ALL ON public.user_centers TO service_role;
ALTER TABLE public.user_centers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  monthly_price numeric NOT NULL DEFAULT 0,
  student_limit int NOT NULL DEFAULT 300,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.center_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'active',
  monthly_price numeric NOT NULL DEFAULT 0,
  started_at date NOT NULL DEFAULT current_date,
  current_period_end date NOT NULL DEFAULT (current_date + 30),
  grace_days int NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (center_id)
);
GRANT SELECT ON public.center_subscriptions TO authenticated;
GRANT ALL ON public.center_subscriptions TO service_role;
ALTER TABLE public.center_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.center_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  due_date date NOT NULL DEFAULT (current_date + 5),
  paid_at timestamptz,
  provider text,
  provider_tx_id text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (center_id, period_month)
);
GRANT SELECT ON public.center_invoices TO authenticated;
GRANT ALL ON public.center_invoices TO service_role;
ALTER TABLE public.center_invoices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.center_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.center_invoices(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  provider text NOT NULL DEFAULT 'manual',
  provider_tx_id text,
  state text NOT NULL DEFAULT 'paid',
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_tx_id)
);
GRANT SELECT ON public.center_payments TO authenticated;
GRANT ALL ON public.center_payments TO service_role;
ALTER TABLE public.center_payments ENABLE ROW LEVEL SECURITY;

-- ============ 2. Yordamchi funksiyalar (private schema) ============

CREATE OR REPLACE FUNCTION private.is_platform_owner(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION private.current_center(_user_id uuid DEFAULT auth.uid())
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT center_id FROM public.user_centers WHERE user_id = _user_id ORDER BY created_at LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.is_platform_owner(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION private.current_center(uuid) FROM anon, authenticated;

-- ============ 3. RLS: platform jadvallari ============

CREATE POLICY centers_owner_all ON public.centers FOR ALL TO authenticated
  USING (private.is_platform_owner()) WITH CHECK (private.is_platform_owner());
CREATE POLICY centers_member_read ON public.centers FOR SELECT TO authenticated
  USING (id = private.current_center());

CREATE POLICY platform_owners_self_read ON public.platform_owners FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_centers_owner_all ON public.user_centers FOR ALL TO authenticated
  USING (private.is_platform_owner()) WITH CHECK (private.is_platform_owner());
CREATE POLICY user_centers_self_read ON public.user_centers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY plans_read ON public.plans FOR SELECT TO authenticated USING (true);
CREATE POLICY plans_owner_all ON public.plans FOR ALL TO authenticated
  USING (private.is_platform_owner()) WITH CHECK (private.is_platform_owner());

CREATE POLICY subs_owner_all ON public.center_subscriptions FOR ALL TO authenticated
  USING (private.is_platform_owner()) WITH CHECK (private.is_platform_owner());
CREATE POLICY subs_member_read ON public.center_subscriptions FOR SELECT TO authenticated
  USING (center_id = private.current_center());

CREATE POLICY invoices_owner_all ON public.center_invoices FOR ALL TO authenticated
  USING (private.is_platform_owner()) WITH CHECK (private.is_platform_owner());
CREATE POLICY invoices_member_read ON public.center_invoices FOR SELECT TO authenticated
  USING (center_id = private.current_center() AND private.has_role(auth.uid(), 'director'));

CREATE POLICY payments_owner_all ON public.center_payments FOR ALL TO authenticated
  USING (private.is_platform_owner()) WITH CHECK (private.is_platform_owner());
CREATE POLICY center_payments_member_read ON public.center_payments FOR SELECT TO authenticated
  USING (center_id = private.current_center() AND private.has_role(auth.uid(), 'director'));

CREATE TRIGGER trg_centers_updated BEFORE UPDATE ON public.centers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.center_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_center_invoices_updated BEFORE UPDATE ON public.center_invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_center_payments_updated BEFORE UPDATE ON public.center_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 4. Boshlang'ich tariflar va joriy markaz ============

INSERT INTO public.plans (code, name, monthly_price, student_limit, features) VALUES
  ('start', 'Start', 490000, 150, '{"telegram_bot":true,"jarvis":false,"fiscal":false,"telephony":false}'::jsonb),
  ('pro', 'Pro', 890000, 400, '{"telegram_bot":true,"jarvis":true,"fiscal":true,"telephony":false}'::jsonb),
  ('premium', 'Premium', 1490000, 1200, '{"telegram_bot":true,"jarvis":true,"fiscal":true,"telephony":true}'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.centers (name, slug, status, student_limit)
SELECT 'Akhmad Academy', 'akhmad-academy', 'active', 1200
WHERE NOT EXISTS (SELECT 1 FROM public.centers);

INSERT INTO public.center_subscriptions (center_id, plan_id, monthly_price, current_period_end)
SELECT c.id, p.id, p.monthly_price, (date_trunc('month', current_date) + INTERVAL '1 month')::date
  FROM public.centers c CROSS JOIN public.plans p
 WHERE c.slug = 'akhmad-academy' AND p.code = 'premium'
ON CONFLICT (center_id) DO NOTHING;

-- Mavjud foydalanuvchilarni joriy markazga bog'laymiz
INSERT INTO public.user_centers (user_id, center_id)
SELECT pr.id, (SELECT id FROM public.centers ORDER BY created_at LIMIT 1)
  FROM public.profiles pr
ON CONFLICT DO NOTHING;