import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, CheckCircle2, GraduationCap, LogOut, Phone, ShieldCheck, Wallet } from "lucide-react";
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
const ATT: Record<string, { label: string; dot: string }> = {
  present: { label: "Keldi", dot: "bg-primary" },
  late: { label: "Kechikdi", dot: "bg-amber-400" },
  absent: { label: "Kelmadi", dot: "bg-destructive" },
  excused: { label: "Sababli", dot: "bg-accent" },
};
const PAY: Record<string, { label: string; cls: string }> = {
  paid: { label: "To'langan", cls: "bg-primary/15 text-primary" },
  partial: { label: "Qisman", cls: "bg-amber-400/15 text-amber-300" },
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

function Overview() {
  const fetchOverview = useServerFn(getParentOverview);
  const q = useQuery({ queryKey: ["parent-overview"], queryFn: () => fetchOverview(), staleTime: 60_000 });
  const [active, setActive] = useState(0);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Farzandim</h1>
        <Button variant="ghost" size="sm" onClick={() => void signOut()}><LogOut /> Chiqish</Button>
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
      {child && <ChildView child={child} />}
      <p className="pt-2 text-center text-[11px] text-muted-foreground">{data.center} · <Phone className="inline h-3 w-3" /> +998 {data.phone}</p>
    </div>
  );
}

function ChildView({ child }: { child: ParentChild }) {
  const today = new Date().toISOString().slice(0, 10);
  const todayMark = child.attendance.find((a) => a.date === today);
  const marked = child.attendance.length;
  const attended = child.attendance.filter((a) => a.status === "present" || a.status === "late").length;
  const percent = marked ? Math.round((attended / marked) * 100) : null;

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="text-lg font-extrabold">{child.name}</div>
        {child.groups.length === 0 && <p className="text-xs text-muted-foreground">Faol guruh yo'q</p>}
        <ul className="mt-2 space-y-2">
          {child.groups.map((g, i) => (
            <li key={i} className="rounded-xl bg-muted/50 p-3 text-sm">
              <div className="flex items-center gap-2 font-semibold"><GraduationCap className="h-4 w-4 text-primary" /> {g.subject ?? g.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {[g.name, g.teacher, g.days.length ? `${g.days.map((d) => DAYS[d]).join(", ")} ${g.start?.slice(0, 5) ?? ""}${g.end ? `–${g.end.slice(0, 5)}` : ""}` : null].filter(Boolean).join(" · ")}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <CheckCircle2 className={`h-9 w-9 shrink-0 ${todayMark && todayMark.status !== "absent" ? "text-primary" : "text-muted-foreground"}`} />
        <div>
          <div className="text-sm font-bold">Bugun</div>
          <div className="text-sm text-muted-foreground">{todayMark ? ATT[todayMark.status]?.label ?? todayMark.status : "Davomat hali belgilanmagan"}</div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold"><Wallet className="h-4 w-4 text-accent" /> To'lovlar</h2>
          <span className={`text-sm font-extrabold ${child.debt > 0 ? "text-destructive" : "text-primary"}`}>{child.debt > 0 ? `Qarz: ${money(child.debt)}` : "Qarz yo'q"}</span>
        </div>
        {child.payments.length === 0 ? <p className="text-xs text-muted-foreground">Hali to'lov yo'q</p> : (
          <ul className="divide-y divide-border text-sm">
            {child.payments.slice(0, 6).map((p) => {
              const m = PAY[p.status] ?? { label: p.status, cls: "bg-muted text-muted-foreground" };
              return (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="text-muted-foreground">{p.period}</span>
                  <span className="font-semibold">{money(p.total)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold"><CalendarDays className="h-4 w-4 text-accent" /> Davomat</h2>
          <span className="text-sm font-extrabold text-primary">{percent === null ? "—" : `${percent}%`}</span>
        </div>
        {marked === 0 ? <p className="text-xs text-muted-foreground">Davomat hali belgilanmagan</p> : (
          <div className="flex flex-wrap gap-1.5">
            {child.attendance.slice(0, 30).map((a) => (
              <span key={a.date} title={ATT[a.status]?.label} className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-1 text-[10px]">
                <span className={`h-2 w-2 rounded-full ${ATT[a.status]?.dot ?? "bg-muted-foreground"}`} />
                {a.date.slice(5).split("-").reverse().join(".")}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold">Baholar</h2>
        {child.grades.length === 0 ? <p className="text-xs text-muted-foreground">Hali baho qo'yilmagan</p> : (
          <ul className="divide-y divide-border text-sm">
            {child.grades.slice(0, 8).map((g, i) => (
              <li key={i} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate text-muted-foreground">{g.date?.slice(5).split("-").reverse().join(".")} · {g.subject ?? g.kind ?? "Baho"}</span>
                <span className="font-extrabold">{g.score}{g.max ? `/${g.max}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
