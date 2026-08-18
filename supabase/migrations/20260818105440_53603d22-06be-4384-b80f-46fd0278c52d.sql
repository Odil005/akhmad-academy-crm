CREATE TABLE IF NOT EXISTS public.methodology_resources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  subject_name text NOT NULL,
  level text NOT NULL,
  title text NOT NULL,
  author text,
  description text,
  resource_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.methodology_resources TO authenticated;
GRANT ALL ON public.methodology_resources TO service_role;

ALTER TABLE public.methodology_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "methodology_read_authenticated" ON public.methodology_resources
  FOR SELECT TO authenticated USING (is_active OR private.has_role(auth.uid(), 'director') OR private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'teacher'));

CREATE POLICY "methodology_manage_staff" ON public.methodology_resources
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'director') OR private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'teacher'))
  WITH CHECK (private.has_role(auth.uid(), 'director') OR private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'teacher'));

CREATE TRIGGER trg_methodology_updated BEFORE UPDATE ON public.methodology_resources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS methodology_subject_level_idx ON public.methodology_resources (subject_name, level, sort_order);

INSERT INTO public.methodology_resources (subject_name, level, title, author, description, resource_url, sort_order) VALUES
('Ingliz tili', 'Boshlang''ich (A1-A2)', 'Family and Friends 1-2 (Student''s Book + Workbook)', 'Naomi Simmons, Oxford University Press', 'Boshlang''ich yosh uchun to''liq kurs: alifbo, fonetika, kundalik leksika. Har dars 45 daqiqaga mo''ljallangan.', 'https://elt.oup.com/catalogue/items/global/young_learners/family_and_friends', 1),
('Ingliz tili', 'Boshlang''ich (A1-A2)', 'English File Elementary (4th ed.)', 'Oxenden & Latham-Koenig, OUP', 'Kattalar uchun A1-A2 darajasi: grammar bank, pronunciation, audio materiallar.', 'https://elt.oup.com/catalogue/items/global/adult_courses/english_file_4th_edition', 2),
('Ingliz tili', 'O''rta (B1-B2)', 'Solutions Intermediate / Upper-Intermediate', 'Tim Falla, Paul A. Davies, OUP', 'B1-B2 uchun kuchli grammatika va yozuv mashqlari, IELTS ga tayyorgarlik ko''prigi.', 'https://elt.oup.com/catalogue/items/global/teenagers/solutions_3rd_edition', 1),
('Ingliz tili', 'O''rta (B1-B2)', 'Grammar in Use Intermediate', 'Raymond Murphy, Cambridge', 'Grammatikani mustahkamlash uchun asosiy qo''llanma — har dars oxirida 1 unit.', 'https://www.cambridge.org/gb/cambridgeenglish/catalog/grammar-vocabulary-and-pronunciation/english-grammar-use-5th-edition', 2),
('Ingliz tili', 'Yuqori (C1 / IELTS)', 'Complete IELTS Bands 6.5-7.5', 'Guy Brook-Hart, Cambridge', 'IELTS 4 ta bo''lim bo''yicha akademik strategiya va mock testlar.', 'https://www.cambridge.org/us/cambridgeenglish/catalog/cambridge-english-exams-ielts/complete-ielts', 1),
('Ingliz tili', 'Yuqori (C1 / IELTS)', 'Cambridge IELTS 15-19 (Official Practice Tests)', 'Cambridge Assessment', 'Har hafta 1 to''liq mock test + xatolar tahlili.', 'https://www.cambridge.org/', 2),
('Matematika', 'Boshlang''ich (5-7 sinf)', 'Matematika 5-6 sinf (Respublika darsligi)', 'A. Mirzaahmedov va boshqalar', 'Milliy o''quv reja asosida: natural sonlar, kasrlar, foiz, oddiy tenglamalar.', 'https://eduportal.uz', 1),
('Matematika', 'Boshlang''ich (5-7 sinf)', 'Matematik mashqlar to''plami (5-7 sinf)', 'M. Sultonov', 'Har dars uchun 15-20 mashq: og''zaki hisob va mantiqiy masalalar.', NULL, 2),
('Matematika', 'O''rta (8-9 sinf)', 'Algebra va geometriya 8-9 sinf', 'Sh. Alixonov', 'Kvadrat tenglamalar, funksiya grafiklari, planimetriya asoslari.', 'https://eduportal.uz', 1),
('Matematika', 'Yuqori (DTM / Prezident maktabi)', 'DTM Matematika test to''plami', 'DTM nashri', 'Blok testlar: har darsda 25 ta test, vaqt bo''yicha nazorat.', 'https://dtm.uz', 1),
('Matematika', 'Yuqori (DTM / Prezident maktabi)', 'Olimpiada masalalari (Prezident maktabi kirish)', 'A. Rasulov', 'Nostandart masalalar, kombinatorika va sonlar nazariyasi.', NULL, 2),
('Rus tili', 'Boshlang''ich (A1-A2)', 'Русский язык. Начальный курс', 'С. Чернышов', 'Alifbo, talaffuz, kundalik muloqot; audio bilan.', NULL, 1),
('Rus tili', 'O''rta (B1)', 'Поехали! 2', 'С. Чернышов, А. Чернышова', 'B1 daraja: matn tahlili, grammatik kategoriyalar, dialoglar.', NULL, 1),
('Ona tili va adabiyot', 'Boshlang''ich', 'Ona tili 5-6 sinf darsligi', 'Respublika ta''lim markazi', 'Fonetika, morfologiya, imlo qoidalari; diktantlar to''plami.', 'https://eduportal.uz', 1),
('Ona tili va adabiyot', 'Yuqori (DTM)', 'Ona tili va adabiyotdan test to''plami', 'DTM nashri', 'Imlo, uslubiyat va adabiyot nazariyasi bo''yicha blok testlar.', 'https://dtm.uz', 1),
('Fizika', 'O''rta (8-9 sinf)', 'Fizika 8-9 sinf darsligi + masalalar', 'P. Habibullayev', 'Mexanika, issiqlik, elektr — laboratoriya ishlari bilan.', 'https://eduportal.uz', 1),
('Fizika', 'Yuqori (DTM)', 'Fizikadan masalalar to''plami', 'I. Irodov (moslashtirilgan)', 'Yuqori darajali masalalar; har dars 10 ta hisob masalasi.', NULL, 1),
('Kimyo', 'O''rta', 'Kimyo 8-9 sinf darsligi', 'H. Omonov', 'Atom tuzilishi, reaksiya tenglamalari, hisob masalalari.', 'https://eduportal.uz', 1),
('Biologiya', 'O''rta', 'Biologiya 8-9 sinf darsligi', 'A. To''xtayev', 'Odam anatomiyasi va o''simliklar dunyosi; sxemalar bilan.', 'https://eduportal.uz', 1),
('Kompyuter savodxonligi / IT', 'Boshlang''ich', 'Kompyuter savodxonligi (amaliy qo''llanma)', 'IT Park Uzbekistan', 'Windows, Word, Excel, internet xavfsizligi — amaliy topshiriqlar bilan.', 'https://it-park.uz', 1),
('Kompyuter savodxonligi / IT', 'O''rta (Dasturlash)', 'Python Crash Course (2-nashr)', 'Eric Matthes', 'Python asoslari + loyihalar; har dars 1 mini-loyiha.', 'https://nostarch.com/python-crash-course-3rd-edition', 1),
('Kompyuter savodxonligi / IT', 'Yuqori (Web)', 'The Odin Project — Full Stack JavaScript', 'The Odin Project', 'HTML/CSS/JS/React bo''yicha bosqichma-bosqich amaliy yo''l xaritasi.', 'https://www.theodinproject.com/', 1),
('Arab tili', 'Boshlang''ich', 'Al-Arabiyyah bayna yadayk 1', 'Abdurrahman al-Fawzan', 'Alifbo, talaffuz va kundalik muloqot; audio bilan.', NULL, 1),
('Koreys tili', 'Boshlang''ich (TOPIK I)', 'Sejong Korean 1-2', 'King Sejong Institute', 'Hangul, asosiy grammatika, TOPIK I ga tayyorgarlik.', 'https://www.ksif.or.kr', 1);