import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, ArrowLeft, User, Mail } from "lucide-react";
import { BackgroundAnimation } from "@/components/BackgroundAnimation";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: { next?: unknown }): { next?: string } => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Kirish — Akhmad Academy CRM" },
      { name: "description", content: "Akhmad Academy CRM tizimiga kirish yoki ro'yxatdan o'tish." },
    ],
  }),
  component: AuthPage,
});


type Tab = "username" | "email";

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const goAfterAuth = () => {
    if (next) {
      window.location.href = next;
      return;
    }
    navigate({ to: "/dashboard" });
  };
  const [tab, setTab] = useState<Tab>("username");

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

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <BackgroundAnimation variant="subtle" />
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Bosh sahifa
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Akhmad Academy CRM</h1>
              <p className="text-xs text-muted-foreground">Kabinetga kirish</p>
            </div>
          </div>

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
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="input"
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
                  <input
                    required
                    type="password"
                    autoComplete="current-password"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
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
