import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Clock, GraduationCap, Loader2, Send, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { miniAppEnter, miniAppRegister, myApplication } from "@/lib/mini-app.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/tg")({
  head: () => ({
    meta: [
      { title: "Telegram ilova | Akhmad Academy" },
      { name: "description", content: "Akhmad Academy ilovasi Telegram ichida: ro'yxatdan o'tish, CRM va ota-ona kabineti." },
      { property: "og:title", content: "Telegram ilova | Akhmad Academy" },
      { property: "og:description", content: "Akhmad Academy'ga Telegram bot orqali kiring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TelegramMiniApp,
});

type TgWebApp = { initData: string; ready: () => void; expand: () => void; initDataUnsafe?: { user?: { first_name?: string; last_name?: string } } };
type View =
  | { s: "loading" }
  | { s: "outside" }
  | { s: "error"; msg: string }
  | { s: "rejected"; reason: string | null }
  | { s: "register"; first: string; last: string }
  | { s: "pending"; name: string; role: string; username: string | null };

function loadTelegram(): Promise<TgWebApp | null> {
  const w = window as unknown as { Telegram?: { WebApp?: TgWebApp } };
  if (w.Telegram?.WebApp) return Promise.resolve(w.Telegram.WebApp);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-web-app.js";
    s.onload = () => resolve(w.Telegram?.WebApp ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

function TelegramMiniApp() {
  const navigate = useNavigate();
  const enter = useServerFn(miniAppEnter);
  const register = useServerFn(miniAppRegister);
  const mine = useServerFn(myApplication);
  const [view, setView] = useState<View>({ s: "loading" });
  const [initData, setInitData] = useState("");

  async function showPending() {
    const app = await mine();
    if (app) setView({ s: "pending", name: `${app.first_name} ${app.last_name ?? ""}`.trim(), role: app.role, username: app.username });
    return Boolean(app);
  }

  async function signInWith(tokenHash: string) {
    await supabase.auth.signOut();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (error) throw new Error("Kirib bo'lmadi, ilovani qayta oching.");
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tg = await loadTelegram();
        tg?.ready();
        tg?.expand();
        const data = tg?.initData ?? "";
        if (!data) {
          const { data: s } = await supabase.auth.getSession();
          if (s.session && (await showPending())) return;
          if (!cancelled) setView({ s: "outside" });
          return;
        }
        setInitData(data);
        const res = await enter({ data: { initData: data } });
        if (cancelled) return;
        if (res.kind === "new") return setView({ s: "register", first: res.firstName, last: res.lastName });
        if (res.kind === "rejected") return setView({ s: "rejected", reason: res.reason });
        await signInWith(res.tokenHash);
        if (res.kind === "applicant") await showPending();
        else navigate({ to: res.next as "/dashboard" });
      } catch (e) {
        if (!cancelled) setView({ s: "error", msg: e instanceof Error ? e.message : "Xato" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto max-w-md space-y-5">
        <header className="flex items-center gap-3">
          <img src="/logo-256.webp?v=akhmad-20261019" alt="Akhmad Academy" width={44} height={44} className="h-11 w-11 rounded-xl" />
          <div>
            <p className="font-semibold">Akhmad Academy</p>
            <p className="text-xs text-muted-foreground">Telegram ilova</p>
          </div>
        </header>

        {view.s === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda…</div>
        )}
        {view.s === "outside" && (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <p className="text-sm">Bu sahifa Telegram bot ichida ochiladi.</p>
            <Button asChild className="w-full"><a href="https://t.me/AkhmadAcademylifebot"><Send className="mr-2 h-4 w-4" /> Botni ochish</a></Button>
          </div>
        )}
        {view.s === "error" && <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{view.msg}</p>}
        {view.s === "rejected" && (
          <div className="rounded-2xl border border-border bg-card p-5 text-sm">Arizangiz rad etilgan.{view.reason ? ` Sabab: ${view.reason}` : ""} Markaz bilan bog'laning.</div>
        )}
        {view.s === "pending" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-warning"><Clock className="h-5 w-5" /><span className="font-medium">Tasdiq kutilmoqda</span></div>
              <p className="mt-2 text-sm text-muted-foreground">Salom, {view.name}! Arizangiz administratorga yuborildi. Tasdiqlangach guruhingiz va darslaringiz shu yerda ko'rinadi.</p>
              {view.username && <p className="mt-3 text-sm">Login: <b>{view.username}</b> (parol Telegram xabarda)</p>}
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 text-sm">
              <p className="font-medium">Akhmad Academy</p>
              <p className="mt-1 text-muted-foreground">Ingliz tili, matematika, IT va boshqa fanlar bo'yicha kurslar. Savollar uchun botga yozing.</p>
            </div>
          </div>
        )}
        {view.s === "register" && (
          <RegisterForm
            first={view.first}
            last={view.last}
            onSubmit={async (form) => {
              const { tokenHash } = await register({ data: { initData, ...form } });
              await signInWith(tokenHash);
              await showPending();
            }}
          />
        )}
      </div>
    </main>
  );
}

function RegisterForm(props: {
  first: string;
  last: string;
  onSubmit: (f: { role: "student" | "parent"; firstName: string; lastName: string; phone: string; subject: string }) => Promise<void>;
}) {
  const [role, setRole] = useState<"student" | "parent">("student");
  const [firstName, setFirst] = useState(props.first);
  const [lastName, setLast] = useState(props.last);
  const [phone, setPhone] = useState("+998");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  return (
    <form
      className="space-y-4 rounded-2xl border border-border bg-card p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr("");
        try {
          await props.onSubmit({ role, firstName, lastName, phone, subject });
        } catch (x) {
          setErr(x instanceof Error ? x.message : "Xato");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <p className="font-semibold">Ro'yxatdan o'tish</p>
        <p className="text-xs text-muted-foreground">Login va parol avtomatik yaratilib, Telegramga yuboriladi.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {([
          ["student", "O'quvchi", GraduationCap],
          ["parent", "Ota-ona", Users],
        ] as const).map(([v, label, Icon]) => (
          <button
            type="button"
            key={v}
            onClick={() => setRole(v)}
            className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-sm ${role === v ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
          >
            <Icon className="h-5 w-5" /> {label}
          </button>
        ))}
      </div>
      <Input required minLength={2} placeholder="Ism" value={firstName} onChange={(e) => setFirst(e.target.value)} />
      <Input required minLength={2} placeholder="Familiya" value={lastName} onChange={(e) => setLast(e.target.value)} />
      <Input required type="tel" placeholder="+998 90 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} />
      {role === "student" && <Input placeholder="Qaysi fan? (masalan, Ingliz tili)" value={subject} onChange={(e) => setSubject(e.target.value)} />}
      {role === "parent" && <p className="text-xs text-muted-foreground">Farzandingiz ro'yxatida yozilgan telefon raqamingizni kiriting.</p>}
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Yuborilmoqda…" : "Ariza yuborish"}</Button>
    </form>
  );
}
