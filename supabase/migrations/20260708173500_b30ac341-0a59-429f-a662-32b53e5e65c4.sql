CREATE TABLE public.homepage_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.homepage_courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homepage_courses TO authenticated;
GRANT ALL ON public.homepage_courses TO service_role;

ALTER TABLE public.homepage_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible courses"
  ON public.homepage_courses FOR SELECT
  USING (is_visible OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Directors and admins can insert courses"
  ON public.homepage_courses FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Directors and admins can update courses"
  ON public.homepage_courses FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Directors and admins can delete courses"
  ON public.homepage_courses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER homepage_courses_set_updated_at
  BEFORE UPDATE ON public.homepage_courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.homepage_courses (title, description, level, sort_order) VALUES
  ('Ingliz tili', 'Boshlang''ich darajadan IELTS/CEFRgacha', 'A1 – C1', 10),
  ('Nemis tili', 'Start Deutsch va TestDaF yo''nalishi', 'A1 – B2', 20),
  ('Rus tili', 'Suhbat, grammatika va yozma nutq', 'A1 – B2', 30),
  ('Tarix-Huquq', 'DTM va blok imtihonlariga tayyorgarlik', '5–11 sinf', 40),
  ('Matematika', 'Maktab dasturi va olimpiadalarga tayyorgarlik', '1–11 sinf', 50),
  ('Kimyo', 'Nazariy va amaliy mashg''ulotlar, DTM', '7–11 sinf', 60),
  ('Biologiya', 'Tibbiyot yo''nalishiga chuqurlashtirilgan', '7–11 sinf', 70);