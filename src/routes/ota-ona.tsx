import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, CalendarDays, CheckCircle2, ChevronRight, Clock, Home, LogOut, Phone, ShieldCheck, UserRound, Users, Wallet, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getParentOverview, requestParentCode, verifyParentCode, type ParentChild } from "@/lib/parent-portal.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/ota-ona")({
  head: () => ({
    meta: [
      { title: "Ota-ona ilovasi | Akhmad Academy" },
      { name: "description", content: "Farzandingizning davomati, to'lovlari va baholari — Akhmad Academy ota-ona ilovasi." },
      { property: "og:title", content: "Ota-ona ilovasi | Akhmad Academy" },
      { property: "og:description", content: "Davomat, to'lov va baholarni telefoningizda kuzating." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ParentApp,
});

const DAYS = ["", "Du", "Se", "Chor", "Pay", "Ju", "Sha", "Yak"];
const WEEK_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const ATT: Record<string, { label: string; dot: string }> = {
  present: { label: "Keldi", dot: "bg-success" },
  late: { label: "Kechikdi", dot: "bg-warning" },
  absent: { label: "Kelmadi", dot: "bg-destructive" },
  excused: { label: "Sababli", dot: "bg-info" },
};
const PAY: Record<string, { label: string; cls: string }> = {
  paid: { label: "To'langan", cls: "bg-success/15 text-success" },
  partial: { label: "Qisman", cls: "bg-warning/15 text-warning" },
  pending: { label: "To'lanmagan", cls: "bg-destructive/15 text-destructive" },
  overdue: { label: "Muddati o'tgan", cls: "bg-destructive/15 text-destructive" },
  refunded: { label: "Qaytarilgan", cls: "bg-accent/15 text-accent" },
};
const money = (n: number) => `${Number(n || 0).toLocaleString("uz-UZ")} so'm`;

/** Points iPhone "Add to Home Screen" and Android install at the parent app instead of the staff CRM. */
function useParentManifest() {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const title = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const prevHref = link?.getAttribute("href");
    const prevTitle = title?.getAttribute("content");
    link?.setAttribute("href", "/manifest-parent.webmanifest");
    title?.setAttribute("content", "Akhmad Ota-ona");
    return () => {
      if (link && prevHref) link.setAttribute("href", prevHref);
      if (title && prevTitle) title.setAttribute("content", prevTitle);
    };
  }, []);
}

function ParentApp() {
  useParentManifest();
  const [session, setSession] = useState<"loading" | "out" | "in">("loading");

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => alive && setSession(data.session ? "in" : "out"));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") setSession(s ? "in" : "out");
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  return (
    <div className="crm-theme min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-md px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="mb-5 flex items-center gap-3">
          <img src="/logo-192.png" alt="Akhmad Academy" width={40} height={40} className="h-10 w-10 rounded-full" />
          <div className="leading-tight">
            <div className="text-base font-extrabold">Akhmad Academy</div>
            <div className="text-xs text-muted-foreground">Ota-ona ilovasi</div>
          </div>
        </header>
        {session === "loading" && <p className="py-16 text-center text-sm text-muted-foreground">Yuklanmoqda…</p>}
        {session === "out" && <LoginCard />}
        {session === "in" && <Overview />}
      </div>
    </div>
  );
}

function LoginCard() {
  const askCode = useServerFn(requestParentCode);
  const checkCode = useServerFn(verifyParentCode);
  const [phone, setPhone] = useState("+998 ");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true); setError(null);
    try {
      const res = await askCode({ data: { phone } });
      setInfo(res.message);
      setStep("code");
    } catch (e) {
      setError((e as Error).message || "Kod yuborilmadi");
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true); setError(null);
    try {
      const { tokenHash } = await checkCode({ data: { phone, code } });
      const { error: otpErr } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (otpErr) throw otpErr;
    } catch (e) {
      setError((e as Error).message || "Kirib bo'lmadi");
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <h1 className="text-xl font-extrabold">Kirish</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Markazga bergan telefon raqamingizni yozing. Kirish kodi Telegram'dagi @AkhmadAcademylifebot orqali keladi.
        </p>
      </div>
      {step === "phone" ? (
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="parent-phone">Telefon raqam</label>
          <Input id="parent-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 text-base" />
          <Button type="submit" disabled={busy} className="h-12 w-full text-base font-bold">
            {busy ? "Yuborilmoqda…" : "Kod olish"}
          </Button>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void verify(); }} className="space-y-3">
          {info && <p className="rounded-lg bg-primary/10 p-3 text-xs text-primary">{info}</p>}
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="parent-code">Telegram'dagi 6 xonali kod</label>
          <Input id="parent-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="h-12 text-center text-2xl tracking-[0.5em]" />
          <Button type="submit" disabled={busy || code.length !== 6} className="h-12 w-full text-base font-bold">
            {busy ? "Tekshirilmoqda…" : "Kirish"}
          </Button>
          <button type="button" onClick={() => { setStep("phone"); setCode(""); }} className="w-full text-xs text-muted-foreground underline">
            Raqamni o'zgartirish yoki kodni qayta olish
          </button>
        </form>
      )}
      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <b className="text-foreground">Kod kelmayaptimi?</b> Telegram'da @AkhmadAcademylifebot'ni oching, /start bosing va
        "Telefon raqamni yuborish" tugmasi bilan raqamingizni yuboring. So'ng qayta kod oling.
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Faqat o'z farzandingiz ma'lumotlari ko'rinadi.</p>
      <Link to="/ilova" className="block text-center text-xs font-semibold text-primary underline">Telefoningizga ilovani o'rnatish</Link>
    </section>
  );
}

type Tab = "home" | "attendance" | "payments" | "grades";
const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Asosiy", icon: Home },
  { id: "attendance", label: "Davomat", icon: CalendarDays },
  { id: "payments", label: "To'lovlar", icon: Wallet },
  { id: "grades", label: "Baholar", icon: BarChart3 },
];

function Overview() {
  const fetchOverview = useServerFn(getParentOverview);
  const q = useQuery({ queryKey: ["parent-overview"], queryFn: () => fetchOverview(), staleTime: 60_000 });
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<Tab>("home");
  const [menu, setMenu] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (q.isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">Yuklanmoqda…</p>;
  if (q.error) {
    return (
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5 text-sm">
        <p>Bu hisob ota-ona hisobi emas yoki ma'lumotlarni olib bo'lmadi.</p>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/dashboard">CRM'ga o'tish</Link></Button>
          <Button variant="ghost" onClick={() => void signOut()}>Chiqish</Button>
        </div>
      </section>
    );
  }
  const data = q.data!;
  const child = data.children[active];
  const title = { home: "Farzandim", attendance: "Davomat", payments: "To'lovlar", grades: "Baholar" }[tab];

  return (
    <div className="space-y-4 pb-24">
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tab === "home" ? "Farzandingiz haqidagi ma'lumotlar" : child?.name}</p>
        </div>
        <button type="button" onClick={() => setMenu((v) => !v)} aria-label="Profil"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
          <UserRound className="h-6 w-6" />
        </button>
        {menu && (
          <div className="absolute right-0 top-14 z-20 w-56 rounded-2xl border border-border bg-popover p-3 shadow-xl">
            <p className="text-xs text-muted-foreground">Kirgan raqam</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold"><Phone className="h-3.5 w-3.5" /> +998 {data.phone}</p>
            <p className="mt-1 text-xs text-muted-foreground">{data.center}</p>
            <Button variant="outline" className="mt-3 w-full" onClick={() => void signOut()}><LogOut /> Chiqish</Button>
          </div>
        )}
      </div>

      {data.children.length === 0 && (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Raqamingizga bog'langan o'quvchi topilmadi. Administrator bilan bog'laning.
        </p>
      )}
      {data.children.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {data.children.map((c, i) => (
            <button key={c.id} onClick={() => setActive(i)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${i === active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
              {c.name}
            </button>
          ))}
        </div>
      )}
      {child && tab === "home" && <ChildHome child={child} onOpen={setTab} />}
      {child && tab === "attendance" && <AttendanceList child={child} />}
      {child && tab === "payments" && <PaymentList child={child} />}
      {child && tab === "grades" && <GradeList child={child} />}

      <nav aria-label="Bo'limlar" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-md">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button key={t.id} type="button" onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }); }}
                className={`relative flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-semibold ${on ? "text-primary" : "text-muted-foreground"}`}>
                <t.icon className="h-6 w-6" />
                {t.label}
                {on && <span className="absolute bottom-0.5 h-1 w-8 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function tashkentToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
}

/** Joriy haftaning Dushanba–Yakshanba sanalari (YYYY-MM-DD). */
function currentWeek(todayIso: string) {
  const d = new Date(`${todayIso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Dushanba
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() - dow + i);
    return x.toISOString().slice(0, 10);
  });
}

function attendancePercent(child: ParentChild) {
  const marked = child.attendance.length;
  const attended = child.attendance.filter((a) => a.status === "present" || a.status === "late").length;
  return marked ? Math.round((attended / marked) * 100) : null;
}

function Card({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-4 rounded-3xl border border-border bg-card p-4 text-left transition active:scale-[0.99]">
      {children}
      {onClick && <ChevronRight className="h-5 w-5 shrink-0 self-center text-muted-foreground" />}
    </button>
  );
}

function ChildHome({ child, onOpen }: { child: ParentChild; onOpen: (t: Tab) => void }) {
  const today = tashkentToday();
  const todayMark = child.attendance.find((a) => a.date === today);
  const percent = attendancePercent(child);
  const week = currentWeek(today);
  const group = child.groups[0];
  const lastPayment = child.payments[0];
  const lastPay = lastPayment ? PAY[lastPayment.status] : null;
  const fee = child.groups.reduce((sum, g) => sum + Number(g.fee || 0), 0);
  const initials = child.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const came = todayMark && (todayMark.status === "present" || todayMark.status === "late");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4">
        <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-2xl font-extrabold text-primary-foreground">{initials}</span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-lg font-extrabold leading-tight">{child.name}</div>
          {group ? (
            <>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Users className="h-4 w-4 shrink-0" /> <span className="truncate">{[group.subject, group.name].filter(Boolean).join(" · ")}</span></div>
              {group.teacher && <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><UserRound className="h-4 w-4 shrink-0" /> <span className="truncate">{group.teacher}</span></div>}
              {group.days.length > 0 && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5 shrink-0" /> {group.days.map((d) => DAYS[d]).join(", ")} {group.start?.slice(0, 5) ?? ""}</div>}
            </>
          ) : <div className="text-sm text-muted-foreground">Faol guruh yo'q</div>}
        </div>
      </div>

      <Card onClick={() => onOpen("attendance")}>
        <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-full ${came ? "bg-success/20 text-success" : todayMark ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground"}`}>
          {came ? <CheckCircle2 className="h-9 w-9" /> : todayMark ? <XCircle className="h-9 w-9" /> : <Clock className="h-8 w-8" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold">{todayMark ? (todayMark.status === "late" ? "Bugun darsga kechikib keldi" : came ? "Bugun darsga keldi" : todayMark.status === "excused" ? "Bugun sababli kelmadi" : "Bugun darsga kelmadi") : "Bugun"}</div>
          <div className={`text-2xl font-extrabold ${came ? "text-success" : todayMark ? "text-destructive" : "text-muted-foreground"}`}>{todayMark ? ATT[todayMark.status]?.label ?? todayMark.status : "Belgilanmagan"}</div>
          <div className="text-sm text-muted-foreground">{came ? "Ajoyib! Davom eting!" : todayMark ? "O'qituvchi bilan bog'laning" : "Davomat hali kiritilmagan"}</div>
        </div>
      </Card>

      <Card onClick={() => onOpen("payments")}>
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-info/15 text-info"><Wallet className="h-8 w-8" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold">To'lov</span>
            {lastPayment && lastPay && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${lastPay.cls}`}>{lastPayment.period}: {lastPay.label}</span>}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{child.debt > 0 ? "Qarzdorlik" : fee > 0 ? "Oylik to'lov" : "Qarz yo'q"}</div>
          <div className={`text-2xl font-extrabold tabular-nums ${child.debt > 0 ? "text-destructive" : "text-info"}`}>{money(child.debt > 0 ? child.debt : fee)}</div>
        </div>
      </Card>

      <Card onClick={() => onOpen("attendance")}>
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-highlight/15 text-highlight"><CalendarDays className="h-8 w-8" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="text-base font-bold">Davomat</span>
            <div className="text-right"><div className="text-2xl font-extrabold text-highlight">{percent === null ? "—" : `${percent}%`}</div><div className="text-[11px] text-muted-foreground">Umumiy davomat</div></div>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 text-center">
            {week.map((day, i) => {
              const mark = child.attendance.find((a) => a.date === day);
              return (
                <div key={day} className="space-y-1">
                  <div className="text-[11px] text-muted-foreground">{WEEK_SHORT[i]}</div>
                  <span className={`mx-auto block h-5 w-5 rounded-full ${mark ? ATT[mark.status]?.dot ?? "bg-muted-foreground" : "border-2 border-border"}`} />
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Card onClick={() => onOpen("grades")}>
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-success/15 text-success"><BarChart3 className="h-8 w-8" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold">Baholar</div>
          {child.grades.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">Hali baho qo'yilmagan</p> : (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {child.grades.slice(0, 3).map((g, i) => (
                <div key={i} className={`rounded-xl p-2 text-center ${gradeTone(g.score, g.max)}`}>
                  <div className="text-xl font-extrabold">{g.score}</div>
                  <div className="truncate text-[11px]">{g.kind ?? g.subject ?? "Baho"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function gradeTone(score: number, max: number | null) {
  const ratio = max ? score / max : score / 5;
  if (ratio >= 0.85) return "bg-success/15 text-success";
  if (ratio >= 0.6) return "bg-warning/15 text-warning";
  return "bg-destructive/15 text-destructive";
}

function AttendanceList({ child }: { child: ParentChild }) {
  const percent = attendancePercent(child);
  return (
    <section className="rounded-3xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{child.attendance.length} ta dars belgilangan</span>
        <span className="text-xl font-extrabold text-highlight">{percent === null ? "—" : `${percent}%`}</span>
      </div>
      {child.attendance.length === 0 ? <p className="text-sm text-muted-foreground">Davomat hali belgilanmagan</p> : (
        <ul className="divide-y divide-border">
          {child.attendance.map((a) => (
            <li key={a.date} className="flex items-center justify-between py-3 text-sm">
              <span>{new Date(`${a.date}T00:00:00`).toLocaleDateString("uz-UZ", { day: "numeric", month: "long", weekday: "short" })}</span>
              <span className="flex items-center gap-2 font-semibold"><span className={`h-2.5 w-2.5 rounded-full ${ATT[a.status]?.dot ?? "bg-muted-foreground"}`} />{ATT[a.status]?.label ?? a.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PaymentList({ child }: { child: ParentChild }) {
  return (
    <section className="space-y-3">
      <div className={`rounded-3xl border p-4 ${child.debt > 0 ? "border-destructive/40 bg-destructive/10" : "border-border bg-card"}`}>
        <div className="text-sm text-muted-foreground">{child.debt > 0 ? "Qarzdorlik" : "Holat"}</div>
        <div className={`text-2xl font-extrabold ${child.debt > 0 ? "text-destructive" : "text-success"}`}>{child.debt > 0 ? money(child.debt) : "Qarz yo'q"}</div>
      </div>
      <div className="rounded-3xl border border-border bg-card p-4">
        {child.payments.length === 0 ? <p className="text-sm text-muted-foreground">Hali to'lov yo'q</p> : (
          <ul className="divide-y divide-border text-sm">
            {child.payments.map((p) => {
              const m = PAY[p.status] ?? { label: p.status, cls: "bg-muted text-muted-foreground" };
              return (
                <li key={p.id} className="flex items-center justify-between gap-2 py-3">
                  <span className="text-muted-foreground">{p.period}</span>
                  <span className="font-semibold tabular-nums">{money(p.total)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function GradeList({ child }: { child: ParentChild }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-4">
      {child.grades.length === 0 ? <p className="text-sm text-muted-foreground">Hali baho qo'yilmagan</p> : (
        <ul className="divide-y divide-border text-sm">
          {child.grades.map((g, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{g.subject ?? g.kind ?? "Baho"}</div>
                <div className="truncate text-xs text-muted-foreground">{g.date?.slice(5).split("-").reverse().join(".")}{g.comment ? ` · ${g.comment}` : ""}</div>
              </div>
              <span className={`shrink-0 rounded-xl px-3 py-1.5 text-base font-extrabold ${gradeTone(g.score, g.max)}`}>{g.score}{g.max ? `/${g.max}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
