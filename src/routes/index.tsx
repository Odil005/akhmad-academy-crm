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
import heroAsset from "@/assets/edunest-hero.png.asset.json";
import logoAsset from "@/assets/edunest-logo.png.asset.json";
import buildingAsset from "@/assets/edunest-building.png.asset.json";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BackgroundAnimation } from "@/components/BackgroundAnimation";
import { ImageCarousel, InfiniteSlider, type CarouselImage } from "@/components/MediaCarousels";


export const Route = createFileRoute("/")({
  component: Index,
});

const NAV_LINKS = [
  { href: "#home", label: "Bosh sahifa" },
  { href: "#courses", label: "Fanlar" },
  { href: "#features", label: "Imkoniyatlar" },
  { href: "#contact", label: "Aloqa" },
];

function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-10 w-10" : "h-12 w-12";
  return (
    <a href="#home" className="flex items-center gap-3">
      <img
        src={logoAsset.url}
        alt="EduNest Learning Center logo"
        className={`${dim} rounded-full object-cover shadow-lg shadow-primary/20`}
      />
      <div className="leading-tight">
        <div className="text-lg font-extrabold tracking-tight text-foreground">
          Edu<span className="text-primary">Nest</span>
        </div>
        <div className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
          LEARNING CENTER
        </div>
      </div>
    </a>
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
    <header className="absolute inset-x-0 top-0 z-40">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 md:px-8">
        <Logo />
        <div className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((l) => (
            <button
              key={l.href}
              onClick={() => handleNav(l.href)}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="hidden items-center gap-4 lg:flex">
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/60 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-primary/10"
          >
            <LogIn className="h-4 w-4" /> Kabinet
          </Link>
          <button
            onClick={() => handleNav("#contact")}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02]"
          >
            Biz bilan bog'lanish
          </button>
        </div>

        <button
          className="rounded-lg border border-border p-2 text-foreground lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>
      {open && (
        <div className="mx-4 rounded-2xl border border-border bg-card/95 p-4 backdrop-blur lg:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <button
                key={l.href}
                onClick={() => handleNav(l.href)}
                className="rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground/90 hover:bg-primary/10"
              >
                {l.label}
              </button>
            ))}
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/60 px-4 py-2 text-sm font-semibold text-foreground hover:bg-primary/10"
            >
              <LogIn className="h-4 w-4" /> Kabinet
            </Link>
            <button
              onClick={() => handleNav("#contact")}
              className="mt-2 rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground"
            >
              Biz bilan bog'lanish
            </button>

          </div>
        </div>
      )}
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

function useHomepageStats() {
  const [values, setValues] = useState(DEFAULT_STATS);
  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "homepage_stats")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setValues({ ...DEFAULT_STATS, ...(data.value as any) });
      });
  }, []);
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
    <section
      id="home"
      className="relative overflow-hidden pb-16 pt-28 md:pb-24 md:pt-32"
    >
      {/* Background image with slow zoom */}
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center hero-bg-zoom"
        style={{ backgroundImage: `url(${heroAsset.url})` }}
        aria-hidden
      />
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 -z-10 hero-gradient-shift" aria-hidden />
      {/* Floating glow orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
      </div>
      {/* Subtle grid shimmer */}
      <div className="pointer-events-none absolute inset-0 -z-10 hero-shimmer opacity-30" aria-hidden />
      <BackgroundAnimation variant="hero" position="absolute" />

      <style>{`
        @keyframes heroZoom {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes heroGradient {
          0%, 100% {
            background: linear-gradient(90deg, oklch(0.14 0.01 60 / 0.92) 0%, oklch(0.14 0.01 60 / 0.75) 55%, oklch(0.14 0.01 60 / 0.55) 100%);
          }
          50% {
            background: linear-gradient(120deg, oklch(0.14 0.01 60 / 0.95) 0%, oklch(0.16 0.02 70 / 0.72) 55%, oklch(0.14 0.01 60 / 0.5) 100%);
          }
        }
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(60px, -40px) scale(1.15); }
          66% { transform: translate(-30px, 50px) scale(0.9); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-80px, 60px) scale(1.2); }
        }
        @keyframes orbFloat3 {
          0%, 100% { transform: translate(0, 0) scale(0.95); }
          50% { transform: translate(50px, -60px) scale(1.1); }
        }
        @keyframes heroShimmer {
          0% { background-position: 0% 0%; }
          100% { background-position: 200% 0%; }
        }
        .hero-bg-zoom { animation: heroZoom 24s ease-in-out infinite; }
        .hero-gradient-shift { animation: heroGradient 14s ease-in-out infinite; }
        .hero-orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(60px);
          will-change: transform;
        }
        .hero-orb-1 {
          top: 10%; right: 10%;
          width: 380px; height: 380px;
          background: radial-gradient(circle, oklch(0.86 0.17 92 / 0.35), transparent 70%);
          animation: orbFloat1 18s ease-in-out infinite;
        }
        .hero-orb-2 {
          bottom: 5%; left: 5%;
          width: 320px; height: 320px;
          background: radial-gradient(circle, oklch(0.86 0.17 92 / 0.25), transparent 70%);
          animation: orbFloat2 22s ease-in-out infinite;
        }
        .hero-orb-3 {
          top: 40%; left: 40%;
          width: 260px; height: 260px;
          background: radial-gradient(circle, oklch(0.72 0.19 45 / 0.22), transparent 70%);
          animation: orbFloat3 20s ease-in-out infinite;
        }
        .hero-shimmer {
          background-image: linear-gradient(110deg, transparent 30%, oklch(0.86 0.17 92 / 0.08) 50%, transparent 70%);
          background-size: 200% 100%;
          animation: heroShimmer 12s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-bg-zoom, .hero-gradient-shift, .hero-orb, .hero-shimmer { animation: none; }
        }
      `}</style>


      <div className="relative mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground md:text-6xl">
              Bilimingizni
              <br />
              <span className="text-primary">EduNest</span> bilan
              <br />
              rivojlantiring
            </h1>
            <div className="mt-8 max-w-md rounded-2xl border border-border bg-card/70 p-5 backdrop-blur">
              <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                <span className="mr-2 text-2xl leading-none text-primary">“</span>
                Maqsadga erishish uchun bo'sh vaqtingiz qolmaydigan darajada qattiq
                o'qishingiz kerak.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#courses"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02]"
              >
                <GraduationCap className="h-4 w-4" /> Fanlarni ko'rish
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#contact"
                className="inline-flex items-center gap-2 rounded-lg border border-primary/60 bg-background/40 px-6 py-3 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-primary/10"
              >
                <Phone className="h-4 w-4" /> Bog'lanish
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-tr from-primary/30 via-primary/10 to-transparent blur-2xl" />
            <div className="overflow-hidden rounded-3xl border border-primary/30 shadow-2xl shadow-primary/20">
              <img
                src={buildingAsset.url}
                alt="EduNest Learning Center binosi"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="relative mx-auto mt-16 max-w-7xl px-4 md:px-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur transition-colors hover:border-primary/50"
            >
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 text-sm font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="relative mx-auto mt-6 max-w-7xl px-4 md:px-8">
        <div className="rounded-2xl border border-border bg-card/70 px-6 py-6 backdrop-blur">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`flex items-center gap-3 ${
                  i > 0 ? "md:border-l md:border-border md:pl-6" : ""
                }`}
              >
                <s.icon className="h-6 w-6 text-primary" />
                <div>
                  <div className="text-xl font-extrabold text-foreground md:text-2xl">
                    {s.value}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
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
  const [courses, setCourses] = useState<HomepageCourse[]>(DEFAULT_COURSES);
  useEffect(() => {
    supabase
      .from("homepage_courses")
      .select("id, title, description, level")
      .eq("is_visible", true)
      .order("sort_order")
      .then(({ data }) => {
        if (data && data.length > 0) setCourses(data as HomepageCourse[]);
      });
  }, []);
  return (
    <section id="courses" className="border-t border-border bg-background py-20">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">
            Fanlar
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
            Sizga mos fanni tanlang
          </h2>
          <p className="mt-3 text-muted-foreground">
            EduNest'da har bir o'quvchi o'z darajasi va maqsadiga mos fanni topa oladi.
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
    <section id="features" className="border-t border-border bg-secondary/30 py-20">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">
              Imkoniyatlar
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
              Nima uchun EduNest?
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

const CERTIFICATES: CarouselImage[] = [
  { src: "https://images.unsplash.com/photo-1606159068539-43f36b99d1b2?w=1200&q=80", alt: "IELTS sertifikat", caption: "IELTS 8.0 — Cambridge" },
  { src: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&q=80", alt: "Xalqaro sertifikat", caption: "TOEFL iBT 110+" },
  { src: "https://images.unsplash.com/photo-1571260899304-425eee4c7efc?w=1200&q=80", alt: "O'qituvchilar sertifikati", caption: "TESOL / CELTA" },
  { src: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=1200&q=80", alt: "Faxriy yorliq", caption: "Yilning eng yaxshi markazi 2024" },
];

const CENTER_PHOTOS: CarouselImage[] = [
  { src: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=900&q=80", alt: "Kutubxona", caption: "Kutubxona" },
  { src: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=900&q=80", alt: "Ma'ruza zali", caption: "Ma'ruza zali" },
  { src: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=900&q=80", alt: "Laboratoriya", caption: "Laboratoriya" },
  { src: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=900&q=80", alt: "Sinfxona", caption: "Zamonaviy sinfxona" },
  { src: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=900&q=80", alt: "Kompyuter xonasi", caption: "IT xonasi" },
  { src: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=900&q=80", alt: "Amfiteatr", caption: "Amfiteatr" },
  { src: "https://images.unsplash.com/photo-1562774053-701939374585?w=900&q=80", alt: "Kirish", caption: "Bosh kirish" },
  { src: "https://images.unsplash.com/photo-1519452575417-564c1401ecc0?w=900&q=80", alt: "Dam olish zonasi", caption: "Dam olish zonasi" },
];

function Certificates() {
  return (
    <section id="certificates" className="relative mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
      <div className="mb-10 text-center">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-primary">Sertifikatlar</div>
        <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Xalqaro <span className="gold-text">tan olingan</span> yutuqlarimiz
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
          O'quvchilarimiz va o'qituvchilarimiz qo'lga kiritgan sertifikatlar
        </p>
      </div>
      <ImageCarousel images={CERTIFICATES} intervalMs={4500} aspect="16/10" />
    </section>
  );
}

function CenterGallery() {
  return (
    <section id="gallery" className="relative py-16 md:py-24">
      <div className="mx-auto mb-10 max-w-7xl px-4 text-center md:px-8">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-primary">Markazimiz</div>
        <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Ta'lim <span className="gold-text">muhitimiz</span>
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
          Zamonaviy sinfxonalar va qulay ta'lim maydonlari
        </p>
      </div>
      <InfiniteSlider images={CENTER_PHOTOS} speed={45} itemWidth="20rem" aspect="16/10" />
    </section>
  );
}

function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [courseList, setCourseList] = useState<HomepageCourse[]>(DEFAULT_COURSES);
  const [form, setForm] = useState({ name: "", phone: "", course: DEFAULT_COURSES[0].title });
  useEffect(() => {
    supabase
      .from("homepage_courses")
      .select("id, title, description, level")
      .eq("is_visible", true)
      .order("sort_order")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setCourseList(data as HomepageCourse[]);
          setForm((f) => ({ ...f, course: (data[0] as HomepageCourse).title }));
        }
      });
  }, []);
  const [info, setInfo] = useState({
    address: "Toshkent shahri, Chilonzor tumani",
    phone: "+998 90 123 45 67",
    email: "info@edunest.uz",
    telegram: "",
    instagram: "",
  });
  useEffect(() => {
    supabase.from("settings").select("value").eq("key", "contact_info").maybeSingle().then(({ data }) => {
      if (data?.value) setInfo((prev) => ({ ...prev, ...(data.value as any) }));
    });
  }, []);
  return (
    <section id="contact" className="border-t border-border bg-background py-20">
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
                course: form.course,
                source: "website",
              });
              setSubmitting(false);
              if (error) { setErrMsg(error.message); return; }
              setSubmitted(true);
              setForm({ name: "", phone: "", course: courseList[0]?.title ?? "" });
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
                  value={form.course}
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
    <footer className="border-t border-border bg-background py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-8">
        <Logo size="sm" />
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} EduNest Learning Center. Barcha huquqlar himoyalangan.
        </p>
      </div>
    </footer>
  );
}

function Index() {
  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <BackgroundAnimation variant="hero" />
      <Header />
      <Hero />
      <Courses />
      <FeaturesSection />
      <Certificates />
      <CenterGallery />
      <Contact />
      <Footer />
    </main>
  );
}
