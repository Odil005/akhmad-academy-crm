import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, ArrowLeft, ArrowRight, User, Mail, Eye, EyeOff, BookOpenCheck, BadgeCheck, Users, CheckCircle2, Wallet, Bell } from "lucide-react";
import heroClassroom from "@/assets/hero-classroom.webp";
import { getSiteTenant, type SiteTenant } from "@/lib/tenant.functions";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: { next?: unknown }): { next?: string } => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { property: "og:title", content: 'Kirish — Akhmad Academy CRM' },
      { property: "og:description", content: "Akhmad Academy CRM tizimiga kirish yoki ro'yxatdan o'tish." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Kirish — Akhmad Academy CRM" },
      { name: "description", content: "Akhmad Academy CRM tizimiga kirish yoki ro'yxatdan o'tish." },
    ],
  }),
  loader: () => getSiteTenant().catch(() => null),
  component: AuthPage,
});


type Tab = "username" | "email";

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const tenant = Route.useLoaderData() as SiteTenant | null;
  const goAfterAuth = () => {
    if (next) {
      window.location.href = next;
      return;
    }
    navigate({ to: "/dashboard" });
  };
  const [tab, setTab] = useState<Tab>("username");
  const [profile, setProfile] = useState<"student" | "staff" | "parent" | null>(null);
  const [stage, setStage] = useState<"choose" | "form">("choose");

  // email tab state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // username tab state
  const [username, setUsername] = useState("");
  const [accessCode, setAccessCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goAfterAuth();
    });
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("akhmad.auth-tab") as Tab | null;
      if (saved === "username" || saved === "email") setTab(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, next]);

  const switchTab = (t: Tab) => {
    setTab(t);
    setError(null);
    if (typeof window !== "undefined") window.localStorage.setItem("akhmad.auth-tab", t);
  };

  const submitUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const cleaned = username.trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,64}$/.test(cleaned)) {
        throw new Error("Foydalanuvchi nomi 3–64 belgidan iborat bo'lishi kerak (a-z, 0-9, . _ -)");
      }
      if (!accessCode) throw new Error("Kirish kodini kiriting");
      const { legacyUsernameEmails, usernameToEmail } = await import("@/lib/credentials");
      const candidates = [usernameToEmail(cleaned), ...legacyUsernameEmails(cleaned)];
      let signedIn = false;
      for (const candidate of candidates) {
        const { error } = await supabase.auth.signInWithPassword({
          email: candidate,
          password: accessCode,
        });
        if (!error) {
          signedIn = true;
          break;
        }
      }
      if (!signedIn) throw new Error("Foydalanuvchi nomi yoki kod xato");
      goAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      goAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  const proceed = () => {
    if (profile === "parent") { navigate({ to: "/ota-ona" }); return; }
    if (profile) { switchTab("username"); setStage("form"); }
  };
  const PROFILES = [
    { id: "student" as const, icon: BookOpenCheck, title: "O'quvchi", desc: "Darslar, uyga vazifa va natijalaringiz" },
    { id: "staff" as const, icon: BadgeCheck, title: "Xodim", desc: "O'qituvchi, administrator va direktor" },
    { id: "parent" as const, icon: Users, title: "Ota-ona", desc: "Farzandingiz davomati, baholari va to'lovlari" },
  ];

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 md:px-14">
        <Link to="/" className="inline-flex w-fit items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
            {tenant?.logo_url ? <img src={tenant.logo_url} alt={tenant.name} className="h-full w-full object-cover" /> : <img src="/logo.png?v=akhmad-20261019" alt="Akhmad Academy" className="h-full w-full object-cover" />}
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg text-primary">{tenant ? tenant.name : "Akhmad Academy"}</span>
            <span className="block text-[11px] text-muted-foreground">O'quv markazi</span>
          </span>
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        {stage === "choose" ? (
          <div>
            <h1 className="font-display text-4xl tracking-tight text-primary md:text-5xl">Profilingizni tanlang</h1>
            <p className="mt-3 text-sm text-muted-foreground">Kim sifatida kirmoqchisiz?</p>
            <div className="mt-8 space-y-3">
              {PROFILES.map((p) => {
                const active = profile === p.id;
                return (
                  <button key={p.id} type="button" onClick={() => setProfile(p.id)}
                    className={`flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition-all ${active ? "border-accent bg-accent/15" : "border-transparent bg-muted/60 hover:bg-muted"}`}>
                    <p.icon className={`h-9 w-9 flex-none ${active ? "text-accent" : "text-muted-foreground"}`} />
                    <span className="flex-1">
                      <span className="block font-semibold text-foreground">{p.title}</span>
                      <span className="block text-sm text-muted-foreground">{p.desc}</span>
                    </span>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${active ? "border-accent" : "border-muted-foreground/40"}`}>
                      {active && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
                    </span>
                  </button>
                );
              })}
            </div>
            <button type="button" disabled={!profile} onClick={proceed}
              className="mt-6 flex w-full items-center justify-between rounded-2xl bg-accent px-6 py-4 text-sm font-semibold text-primary transition-opacity disabled:bg-muted disabled:text-muted-foreground">
              <span className="flex-1 text-center">Davom etish</span> <ArrowRight className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => { switchTab("email"); setStage("form"); }} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-primary">
              Email bilan kirish
            </button>
          </div>
        ) : (
        <div>
          <button type="button" onClick={() => { setStage("choose"); setError(null); }} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Orqaga
          </button>
          <h1 className="font-display text-3xl text-primary md:text-4xl">{tab === "email" ? "Email bilan kirish" : profile === "student" ? "O'quvchi kabineti" : "Xodim kabineti"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{tenant ? `${tenant.name} · UNI CRM` : "Akhmad Academy CRM"}</p>
          <div className="hidden">
          {/* Tab switcher */}
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
            <button
              type="button"
              onClick={() => switchTab("username")}
              className={`inline-flex items-center justify-center gap-2 rounded-md py-2 text-sm font-semibold transition-colors ${
                tab === "username" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="h-4 w-4" /> Xodim / O'quvchi
            </button>
            <button
              type="button"
              onClick={() => switchTab("email")}
              className={`inline-flex items-center justify-center gap-2 rounded-md py-2 text-sm font-semibold transition-colors ${
                tab === "email" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="h-4 w-4" /> Email bilan
            </button>
          </div>
          </div>

          {tab === "username" ? (
            <form onSubmit={submitUsername} className="mt-6 space-y-4">
              <Field label="Foydalanuvchi nomi">
                <input
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input"
                  placeholder="masalan: alisher.karimov1234"
                />
              </Field>
              <Field label="Kirish kodi">
                <PasswordInput
                  value={accessCode}
                  onChange={setAccessCode}
                  placeholder="Ma'muriyat bergan kod"
                />
              </Field>
              {error && (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {loading ? "..." : "Kirish"}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                O'qituvchi va o'quvchi <b>ma'muriyat bergan</b> foydalanuvchi nomi va kod bilan kiradi.
              </p>
            </form>
          ) : (
            <>
              <form onSubmit={submitEmail} className="mt-6 space-y-4">
                <Field label="Email">
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="you@example.com"
                  />
                </Field>
                <Field label="Parol">
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    minLength={6}
                    placeholder="Parol"
                  />
                </Field>
                {error && (
                  <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {loading ? "..." : "Kirish"}
                </button>
              </form>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Ro'yxatdan o'tish faqat direktor/admin tomonidan amalga oshiriladi. Hisob kerak bo'lsa ma'muriyatga murojaat qiling.
              </p>
            </>
          )}
        </div>
        )}
        </div>
      </div>
      <AuthShowcase />
      </div>
      <style>{`.input{width:100%;border-radius:.5rem;border:1px solid var(--border);background:var(--background);padding:.75rem 1rem;font-size:.875rem;color:var(--foreground);outline:none}.input:focus{border-color:var(--primary)}`}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  minLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        required
        type={visible ? "text" : "password"}
        autoComplete="current-password"
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
        style={{ paddingRight: "3rem" }}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Parolni yashirish" : "Parolni ko'rsatish"}
        title={visible ? "Parolni yashirish" : "Parolni ko'rsatish"}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-primary"
      >
        {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}


function AuthShowcase() {
  return (
    <div className="relative hidden p-4 lg:block">
      <div className="relative h-full overflow-hidden rounded-3xl bg-primary">
        <img src={heroClassroom} alt="Akhmad Academy darsxonasi" className="absolute inset-0 h-full w-full object-cover opacity-70" width={1280} height={1024} />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/30 to-transparent" />
        <a href="/" className="absolute right-6 top-6 rounded-full bg-background px-5 py-2.5 text-sm font-medium text-foreground">akhmadacademy.life ↗</a>

        <div className="float-a absolute left-10 top-28 w-64 rounded-2xl bg-background/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-accent" /> Bugungi davomat</div>
          <div className="mt-2 font-display text-3xl text-primary">94%</div>
          <div className="mt-2 flex gap-1">{[1,1,1,0,1,1,1,1,0,1].map((v, i) => <span key={i} className={`h-6 flex-1 rounded ${v ? "bg-accent" : "bg-muted"}`} />)}</div>
        </div>

        <div className="float-b absolute right-10 top-1/3 w-60 rounded-2xl bg-background/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Wallet className="h-4 w-4 text-accent" /> To'lov qabul qilindi</div>
          <div className="mt-2 text-lg font-bold text-primary">450 000 so'm</div>
          <div className="text-xs text-muted-foreground">Ingliz tili · Noyabr</div>
        </div>

        <div className="float-c absolute bottom-28 left-14 w-72 rounded-2xl bg-background/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Bell className="h-4 w-4 text-accent" /> Ota-onaga Telegram xabar</div>
          <p className="mt-2 text-sm text-foreground">Farzandingiz darsga keldi. Bugungi baho: <b>5</b></p>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-10 text-primary-foreground">
          <p className="font-display text-3xl">Bilim — eng katta boylik</p>
          <p className="mt-2 text-sm text-primary-foreground/75">O'quvchi, ustoz va ota-ona — barchasi bitta tizimda.</p>
        </div>
      </div>
      <style>{`@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}.float-a{animation:floaty 6s ease-in-out infinite}.float-b{animation:floaty 7s ease-in-out 1s infinite}.float-c{animation:floaty 8s ease-in-out .5s infinite}@media (prefers-reduced-motion:reduce){.float-a,.float-b,.float-c{animation:none}}`}</style>
    </div>
  );
}
