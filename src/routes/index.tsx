import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  Users,
  Calendar,
  TrendingUp,
  Headphones,
  GraduationCap,
  Phone,
  ArrowRight,
  Mail,
  MapPin,
  Award,
  Menu,
  X,
  LogIn,
  Send,
  Instagram,
} from "lucide-react";
const logoAsset = { url: "/logo.png", webp: "/logo-256.webp" };
import heroClassroom from "@/assets/hero-classroom.webp";
import heroClassroom640 from "@/assets/hero-classroom-640.webp";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BackgroundAnimation } from "@/components/BackgroundAnimation";


export const Route = createFileRoute("/")({
  component: Index,
});

const NAV_LINKS = [
  { href: "#home", label: "Bosh sahifa" },
  { href: "#courses", label: "Fanlar" },
  { href: "#features", label: "Imkoniyatlar" },
  { href: "#contact", label: "Aloqa" },
];

function Monogram({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <picture>
      <source srcSet={logoAsset.webp} type="image/webp" />
      <img
        src={logoAsset.url}
        alt="Akhmad Academy logo"
        className={`${className} rounded-full object-cover`}
        decoding="async"
        fetchPriority="high"
        width={48}
        height={48}
      />
    </picture>
  );
}


function Header() {
  const [open, setOpen] = useState(false);
  const handleNav = (href: string) => {
    setOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <header className="relative z-40">
      {/* Ticker strip */}
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5 md:px-8">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-accent">
            Akhmad Academy
          </span>
          <span className="hidden h-px flex-1 bg-accent/40 sm:block" />
          <ArrowRight className="hidden h-4 w-4 text-accent/70 sm:block" />
        </div>
      </div>

      {/* Nav */}
      <div className="bg-primary">
        <nav className="mx-auto flex max-w-[1400px] items-stretch justify-between px-4 md:px-8">
          <a href="#home" className="flex items-center gap-4 py-4">
            <Monogram className="h-11 w-11" />
            <span className="font-display text-base tracking-[0.28em] text-primary-foreground">
              AKHMAD ACADEMY
            </span>
          </a>

          <div className="hidden items-center gap-9 lg:flex">
            {NAV_LINKS.map((l) => (
              <button
                key={l.href}
                onClick={() => handleNav(l.href)}
                className="text-sm font-medium text-primary-foreground/85 transition-colors hover:text-accent"
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="hidden items-center gap-2 px-5 text-sm font-semibold text-primary-foreground/85 transition-colors hover:text-accent lg:inline-flex"
            >
              <LogIn className="h-4 w-4" /> Kabinet
            </Link>
            <button
              onClick={() => handleNav("#contact")}
              className="hidden items-center gap-3 self-stretch bg-[oklch(0.45_0.22_265)] px-8 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[oklch(0.50_0.22_265)] lg:inline-flex"
            >
              Qabulga yozilish <ArrowRight className="h-4 w-4" />
            </button>
            <button
              className="my-3 rounded-lg border border-primary-foreground/25 p-2 text-primary-foreground lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {open && (
          <div className="border-t border-primary-foreground/10 px-4 pb-4 lg:hidden">
            <div className="flex flex-col gap-1 pt-3">
              {NAV_LINKS.map((l) => (
                <button
                  key={l.href}
                  onClick={() => handleNav(l.href)}
                  className="rounded-lg px-3 py-2 text-left text-sm font-medium text-primary-foreground/90 hover:bg-primary-foreground/10"
                >
                  {l.label}
                </button>
              ))}
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-accent/60 px-4 py-2 text-sm font-semibold text-accent"
              >
                <LogIn className="h-4 w-4" /> Kabinet
              </Link>
              <button
                onClick={() => handleNav("#contact")}
                className="mt-2 rounded-lg bg-[oklch(0.45_0.22_265)] px-4 py-2 text-center text-sm font-semibold text-primary-foreground"
              >
                Qabulga yozilish
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

const features = [
  { icon: GraduationCap, title: "Ko'p fanli kurslar", desc: "Turli yo'nalishlar bo'yicha kurslar" },
  { icon: Users, title: "Malakali o'qituvchilar", desc: "Tajribali va sertifikatli mutaxassislar" },
  { icon: Calendar, title: "Dars jadvali", desc: "Qulay va moslashuvchan dars jadvali" },
  { icon: TrendingUp, title: "Natijani kuzatish", desc: "O'z progressingizni oson kuzating" },
  { icon: Headphones, title: "24/7 Qo'llab-quvvatlash", desc: "Har doim yordamga tayyor jamoa" },
];

const DEFAULT_STATS = {
  students: "1200+",
  courses: "50+",
  teachers: "35+",
  satisfaction: "98%",
};

/** Shared, cached landing-page queries — deduplicated across components. */
function useSetting<T>(key: string, fallback: T) {
  const { data } = useQuery({
    queryKey: ["public-setting", key],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
      return (data?.value ?? null) as T | null;
    },
  });
  return data ? { ...fallback, ...(data as object) } : fallback;
}

function useHomepageCourses() {
  const { data } = useQuery({
    queryKey: ["public-homepage-courses"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("homepage_courses")
        .select("id, title, description, level")
        .eq("is_visible", true)
        .order("sort_order");
      return (data ?? []) as HomepageCourse[];
    },
  });
  return data && data.length > 0 ? data : DEFAULT_COURSES;
}

function useHomepageStats() {
  const values = useSetting("homepage_stats", DEFAULT_STATS);
  return [
    { icon: Users, value: values.students, label: "O'quvchilar" },
    { icon: BookOpen, value: values.courses, label: "Kurslar" },
    { icon: GraduationCap, value: values.teachers, label: "O'qituvchilar" },
    { icon: Award, value: values.satisfaction, label: "Mamnun o'quvchilar" },
  ];
}

function Hero() {
  const stats = useHomepageStats();
  return (
    <section id="home" className="relative bg-primary">
      <div className="mx-auto max-w-[1400px] px-4 md:px-8">
        <div className="relative grid gap-0 overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Left panel */}
          <div className="relative z-10 bg-background px-6 py-16 md:px-14 md:py-28">
            <div className="flex gap-6 md:gap-10">
              <div className="hidden flex-col items-center gap-4 pt-4 md:flex">
                <span className="h-16 w-px bg-accent" />
                {["01", "02", "03", "04"].map((n, i) => (
                  <span
                    key={n}
                    className={`text-[11px] tracking-[0.25em] ${i === 0 ? "text-accent" : "text-muted-foreground/50"}`}
                  >
                    {n}
                  </span>
                ))}
              </div>

              <div className="min-w-0 max-w-xl">
                <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-accent">
                  Akhmad Academy
                </span>
                <h1
                  className="mt-5 pb-2 font-display tracking-tight text-primary"
                  style={{
                    fontSize: "clamp(2.15rem, 6.2vw, 3.6rem)",
                    lineHeight: 1.14,
                    textWrap: "balance",
                  }}
                >
                  Natija tasodif emas. U tizimdan boshlanadi.
                </h1>
                <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                  Zamonaviy o'quv markazi: aniq jadval, shaffof to'lov, har bir o'quvchi uchun
                  individual natija xaritasi.
                </p>
                <div className="mt-8 h-px w-40 bg-accent" />
                <a
                  href="#courses"
                  className="mt-9 inline-flex items-center gap-5 border border-primary/40 px-7 py-4 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                >
                  Akademiyani ko'rish <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>

          </div>

          {/* Right image */}
          <div className="relative min-h-[280px] md:min-h-[420px]">
            <img
              src={heroClassroom}
              srcSet={`${heroClassroom640} 640w, ${heroClassroom} 1280w`}
              sizes="(max-width: 768px) 100vw, 50vw"
              alt="Akhmad Academy o'quvchilari darsda"
              className="absolute inset-0 h-full w-full object-cover"
              width={1280}
              height={1024}
              fetchPriority="high"
              decoding="async"
            />

            <div className="absolute inset-0 bg-primary/10" />
            <div
              className="absolute inset-y-0 -left-px hidden w-24 bg-background md:block"
              style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
              aria-hidden
            />
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="border-t border-accent/20">
        <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-y-6 px-4 py-7 md:grid-cols-4 md:px-8">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`flex items-center justify-center gap-3 ${i > 0 ? "md:border-l md:border-accent/25" : ""}`}
            >
              <s.icon className="h-6 w-6 text-accent" />
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl text-primary-foreground md:text-3xl">
                  {s.value}
                </span>
                <span className="text-sm text-primary-foreground/70">{s.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

type HomepageCourse = { id: string; title: string; description: string; level: string };

const DEFAULT_COURSES: HomepageCourse[] = [
  { id: "1", title: "Ingliz tili", description: "Boshlang'ich darajadan IELTS/CEFRgacha", level: "A1 – C1" },
  { id: "2", title: "Nemis tili", description: "Start Deutsch va TestDaF yo'nalishi", level: "A1 – B2" },
  { id: "3", title: "Rus tili", description: "Suhbat, grammatika va yozma nutq", level: "A1 – B2" },
];

function Courses() {
  const courses = useHomepageCourses();
  return (
    <section id="courses" className="border-t border-border/60 bg-background/70 py-20 cv-auto">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">
            Fanlar
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
            Sizga mos fanni tanlang
          </h2>
          <p className="mt-3 text-muted-foreground">
            Akhmad Academy'da har bir o'quvchi o'z darajasi va maqsadiga mos fanni topa oladi.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <div
              key={c.id}
              className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/10"
            >
              <div className="flex items-start justify-between">
                <BookOpen className="h-8 w-8 text-primary" />
                {c.level && (
                  <span className="rounded-full border border-primary/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {c.level}
                  </span>
                )}
              </div>
              <h3 className="mt-5 text-xl font-bold text-foreground">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
              <a
                href="#contact"
                className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-primary"
              >
                Batafsil{" "}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="border-t border-border/60 bg-secondary/40 py-20 cv-auto">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">
              Imkoniyatlar
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
              Nima uchun Akhmad Academy?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Zamonaviy metodikalar, individual yondashuv va natijaga qaratilgan dars
              rejalarimiz sizni maqsadingizga tezroq olib boradi.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Zamonaviy jihozlangan sinf xonalari",
                "Kichik guruhlarda mashg'ulotlar (6–10 kishi)",
                "Har oy nazorat testlari va progress hisoboti",
                "Sertifikat va imtihonlarga tayyorgarlik",
              ].map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-foreground/90">
                  <span className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary/20 text-primary">
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {features.slice(0, 4).map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
              >
                <f.icon className="h-8 w-8 text-primary" />
                <h3 className="mt-4 text-base font-bold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}


function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const courseList = useHomepageCourses();
  const [form, setForm] = useState({ name: "", phone: "", course: "" });
  const selectedCourse = form.course || courseList[0].title;
  const info = useSetting("contact_info", {
    address: "Toshkent shahri, Chilonzor tumani",
    phone: "+998 90 123 45 67",
    email: "info@akhmadacademy.uz",
    telegram: "",
    instagram: "",
  });
  return (
    <section id="contact" className="border-t border-border/60 bg-background/70 py-20 cv-auto">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div>
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">
              Aloqa
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
              Biz bilan bog'laning
            </h2>
            <p className="mt-3 text-muted-foreground">
              Bepul maslahat va sinov darsi uchun ma'lumotlaringizni qoldiring —
              tez orada siz bilan bog'lanamiz.
            </p>
            <div className="mt-8 space-y-4 text-sm">
              {info.phone && (
                <a href={`tel:${info.phone.replace(/\s+/g, "")}`} className="flex items-center gap-3 text-foreground/90 hover:text-primary">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Phone className="h-4 w-4" />
                  </span>
                  {info.phone}
                </a>
              )}
              {info.email && (
                <a href={`mailto:${info.email}`} className="flex items-center gap-3 text-foreground/90 hover:text-primary">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Mail className="h-4 w-4" />
                  </span>
                  {info.email}
                </a>
              )}
              {info.address && (
                <div className="flex items-center gap-3 text-foreground/90">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <MapPin className="h-4 w-4" />
                  </span>
                  {info.address}
                </div>
              )}
              {info.telegram && (
                <a href={info.telegram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-foreground/90 hover:text-primary">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Send className="h-4 w-4" />
                  </span>
                  Telegram kanal
                </a>
              )}
              {info.instagram && (
                <a href={info.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-foreground/90 hover:text-primary">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Instagram className="h-4 w-4" />
                  </span>
                  Instagram
                </a>
              )}
            </div>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSubmitting(true); setErrMsg(null);
              const { error } = await supabase.from("leads").insert({
                name: form.name.trim(),
                phone: form.phone.trim(),
                course: selectedCourse,
                source: "website",
              });
              setSubmitting(false);
              if (error) { setErrMsg(error.message); return; }
              setSubmitted(true);
              setForm({ name: "", phone: "", course: "" });
              setTimeout(() => setSubmitted(false), 5000);
            }}
            className="rounded-2xl border border-border bg-card p-6 md:p-8"
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ism
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                  placeholder="Ismingiz"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Telefon raqam
                </label>
                <input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                  placeholder="+998 __ ___ __ __"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Qiziqtirgan fan
                </label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setForm({ ...form, course: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                >
                  {courseList.map((c) => (
                    <option key={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.01]"
              >
                Yuborish <ArrowRight className="h-4 w-4" />
              </button>
              {submitted && (
                <p className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-center text-sm text-primary">
                  Rahmat! Tez orada siz bilan bog'lanamiz.
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background/80 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-8">
        <div className="flex items-center gap-3">
          <Monogram className="h-10 w-10" />
          <span className="font-display text-sm tracking-[0.25em] text-primary">AKHMAD ACADEMY</span>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Akhmad Academy. Barcha huquqlar himoyalangan.
        </p>
      </div>
    </footer>
  );
}

function Index() {
  return (
    <main className="relative min-h-screen bg-transparent text-foreground">
      <BackgroundAnimation variant="hero" />
      <Header />
      <Hero />
      <Courses />
      <FeaturesSection />
      <Contact />
      <Footer />
    </main>
  );
}
