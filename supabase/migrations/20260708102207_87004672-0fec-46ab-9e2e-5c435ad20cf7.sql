
-- ============ STUDENT STATUS SYSTEM ============
CREATE TYPE public.student_status AS ENUM ('trial','active','frozen','archived','left');

-- Extend students with parent info and structured status
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS parent_full_name TEXT,
  ADD COLUMN IF NOT EXISTS parent_phone TEXT,
  ADD COLUMN IF NOT EXISTS parent_telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS parent_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS status_enum public.student_status NOT NULL DEFAULT 'trial';

UPDATE public.students SET status_enum = 'active'::public.student_status WHERE status = 'active';

CREATE TABLE public.student_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  from_status public.student_status,
  to_status public.student_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.student_status_history TO authenticated;
GRANT ALL ON public.student_status_history TO service_role;
ALTER TABLE public.student_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ssh: staff read" ON public.student_status_history FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ssh: staff write" ON public.student_status_history FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));

-- ============ CREDENTIALS ============
CREATE TABLE public.student_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  access_code TEXT NOT NULL,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.teacher_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  access_code TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.admin_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  access_code TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_credentials, public.teacher_credentials, public.admin_credentials TO authenticated;
GRANT ALL ON public.student_credentials, public.teacher_credentials, public.admin_credentials TO service_role;
ALTER TABLE public.student_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sc: staff all" ON public.student_credentials FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "tc: staff all" ON public.teacher_credentials FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ac: director all" ON public.admin_credentials FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director'))
WITH CHECK (public.has_role(auth.uid(),'director'));

-- ============ MARKETPLACE ============
CREATE TABLE public.marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.marketplace_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.marketplace_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  product_type TEXT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  stock INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  ordered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.marketplace_products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_categories, public.marketplace_products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.marketplace_categories, public.marketplace_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_orders TO authenticated;
GRANT ALL ON public.marketplace_categories, public.marketplace_products, public.marketplace_orders TO service_role;
ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mc: read all" ON public.marketplace_categories FOR SELECT USING (true);
CREATE POLICY "mc: staff write" ON public.marketplace_categories FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "mp: read all" ON public.marketplace_products FOR SELECT USING (true);
CREATE POLICY "mp: staff write" ON public.marketplace_products FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "mo: staff read" ON public.marketplace_orders FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.profile_id = auth.uid()));
CREATE POLICY "mo: authed create" ON public.marketplace_orders FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.profile_id = auth.uid())
);
CREATE POLICY "mo: staff manage" ON public.marketplace_orders FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "mo: staff delete" ON public.marketplace_orders FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));

-- ============ BEHAVIOR EVALUATIONS ============
CREATE TYPE public.behavior_rating AS ENUM ('qoniqarsiz','qoniqarli','yaxshi','alo');

CREATE TABLE public.behavior_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  lesson_date DATE NOT NULL DEFAULT CURRENT_DATE,
  rating public.behavior_rating NOT NULL,
  comment TEXT,
  telegram_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.behavior_evaluations TO authenticated;
GRANT ALL ON public.behavior_evaluations TO service_role;
ALTER TABLE public.behavior_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "be: staff read" ON public.behavior_evaluations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin')
  OR teacher_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.profile_id = auth.uid()));
CREATE POLICY "be: teacher insert" ON public.behavior_evaluations FOR INSERT TO authenticated
WITH CHECK (teacher_id = auth.uid() AND public.has_role(auth.uid(),'teacher'));
CREATE POLICY "be: staff manage" ON public.behavior_evaluations FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin') OR teacher_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin') OR teacher_id = auth.uid());
CREATE POLICY "be: staff delete" ON public.behavior_evaluations FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));

-- ============ PARENT NOTIFICATIONS LOG ============
CREATE TABLE public.parent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'telegram',
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.parent_notifications TO authenticated;
GRANT ALL ON public.parent_notifications TO service_role;
ALTER TABLE public.parent_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pn: staff read" ON public.parent_notifications FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "pn: authed insert" ON public.parent_notifications FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher'));

-- ============ TEACHER BALANCE ============
CREATE TABLE public.teacher_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
  penalty NUMERIC(12,2) NOT NULL DEFAULT 0,
  kpi_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  note TEXT,
  visible_to_teacher BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_user_id, period_month)
);
CREATE TABLE public.teacher_salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_balance, public.teacher_salary_payments TO authenticated;
GRANT ALL ON public.teacher_balance, public.teacher_salary_payments TO service_role;
ALTER TABLE public.teacher_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_salary_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tb: director all" ON public.teacher_balance FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director'))
WITH CHECK (public.has_role(auth.uid(),'director'));
CREATE POLICY "tb: teacher read visible" ON public.teacher_balance FOR SELECT TO authenticated
USING (teacher_user_id = auth.uid() AND visible_to_teacher = TRUE);
CREATE POLICY "tsp: director all" ON public.teacher_salary_payments FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director'))
WITH CHECK (public.has_role(auth.uid(),'director'));

-- ============ SETTINGS / DESIGN / HOMEPAGE / NEWS / BANNERS ============
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  scope TEXT NOT NULL DEFAULT 'director',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.design_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url TEXT,
  hero_image_url TEXT,
  animated_bg_url TEXT,
  animation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  primary_color TEXT DEFAULT '#FACC15',
  secondary_color TEXT DEFAULT '#0A0A0A',
  main_headline TEXT,
  main_subheadline TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.homepage_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL UNIQUE,
  title TEXT,
  content JSONB NOT NULL DEFAULT '{}',
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT,
  position TEXT NOT NULL DEFAULT 'home_hero',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.teacher_ui_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_items JSONB NOT NULL DEFAULT '[]',
  enabled_modules JSONB NOT NULL DEFAULT '{}',
  dashboard_cards JSONB NOT NULL DEFAULT '[]',
  announcements JSONB NOT NULL DEFAULT '[]',
  background_url TEXT,
  banner_url TEXT,
  kpi_visible BOOLEAN NOT NULL DEFAULT FALSE,
  attendance_rules JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.design_settings, public.homepage_sections, public.news, public.banners, public.teacher_ui_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.design_settings, public.homepage_sections, public.news, public.banners, public.teacher_ui_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings, public.design_settings, public.homepage_sections, public.news, public.banners, public.teacher_ui_settings TO service_role;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_ui_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings: staff read" ON public.settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'director') OR (public.has_role(auth.uid(),'admin') AND scope IN ('admin','shared')));
CREATE POLICY "settings: director write" ON public.settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director')) WITH CHECK (public.has_role(auth.uid(),'director'));
CREATE POLICY "settings: admin write scoped" ON public.settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') AND scope IN ('admin','shared'))
WITH CHECK (public.has_role(auth.uid(),'admin') AND scope IN ('admin','shared'));

CREATE POLICY "design: read all" ON public.design_settings FOR SELECT USING (true);
CREATE POLICY "design: director write" ON public.design_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director')) WITH CHECK (public.has_role(auth.uid(),'director'));

CREATE POLICY "hs: read all" ON public.homepage_sections FOR SELECT USING (true);
CREATE POLICY "hs: director write" ON public.homepage_sections FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director')) WITH CHECK (public.has_role(auth.uid(),'director'));

CREATE POLICY "news: read published" ON public.news FOR SELECT USING (is_published = TRUE OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "news: staff write" ON public.news FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "banners: read active" ON public.banners FOR SELECT USING (is_active = TRUE OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "banners: staff write" ON public.banners FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "tus: read all" ON public.teacher_ui_settings FOR SELECT USING (true);
CREATE POLICY "tus: director write" ON public.teacher_ui_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director')) WITH CHECK (public.has_role(auth.uid(),'director'));

-- ============ SEED MARKETPLACE ============
INSERT INTO public.marketplace_categories (name, slug, icon, sort_order) VALUES
  ('Kitoblar', 'books', '📚', 1),
  ('Ichimliklar', 'drinks', '🥤', 2),
  ('Kanstovarlar', 'stationery', '✏️', 3),
  ('O''quv materiallari', 'learning-materials', '🎓', 4),
  ('Formalar', 'uniforms', '👕', 5),
  ('Boshqa mahsulotlar', 'other', '📦', 6)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.marketplace_products (category_id, name, description, price, product_type, is_available) VALUES
  ((SELECT id FROM public.marketplace_categories WHERE slug='books'), 'Nemis tili kitobi', 'A1-A2 daraja darslik', 85000, 'book', true),
  ((SELECT id FROM public.marketplace_categories WHERE slug='books'), 'Ingliz tili kitobi', 'Cambridge darslik', 120000, 'book', true),
  ((SELECT id FROM public.marketplace_categories WHERE slug='stationery'), 'Daftar', '48 varaqli', 8000, 'stationery', true),
  ((SELECT id FROM public.marketplace_categories WHERE slug='stationery'), 'Ruchka', 'Ko''k rangli', 3000, 'stationery', true),
  ((SELECT id FROM public.marketplace_categories WHERE slug='drinks'), 'Suv', '0.5L', 3000, 'drink', true),
  ((SELECT id FROM public.marketplace_categories WHERE slug='drinks'), 'Sok', 'Mevali', 8000, 'drink', true),
  ((SELECT id FROM public.marketplace_categories WHERE slug='drinks'), 'Qahva', 'Espresso', 12000, 'drink', true),
  ((SELECT id FROM public.marketplace_categories WHERE slug='drinks'), 'Choy', 'Qora choy', 5000, 'drink', true),
  ((SELECT id FROM public.marketplace_categories WHERE slug='uniforms'), 'EduNest futbolka', 'Brendli', 95000, 'uniform', true)
ON CONFLICT DO NOTHING;

-- Default design row
INSERT INTO public.design_settings (main_headline, main_subheadline)
SELECT 'EduNest Learning Center', 'Bilimingizni EduNest bilan rivojlantiring'
WHERE NOT EXISTS (SELECT 1 FROM public.design_settings);

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_marketplace_products_updated BEFORE UPDATE ON public.marketplace_products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_teacher_balance_updated BEFORE UPDATE ON public.teacher_balance
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_design_updated BEFORE UPDATE ON public.design_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
