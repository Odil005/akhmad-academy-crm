import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { listPublicCenters, submitCenterApplication } from "@/lib/platform.functions";
import uniLogo from "@/assets/uni-crm-logo.png.asset.json";

export const Route = createFileRoute("/uni")({
  head: () => ({
    meta: [
      { title: "UNI CRM — o'quv markazlar uchun boshqaruv tizimi" },
      {
        name: "description",
        content:
          "UNI CRM — o'quv markazlar uchun yagona boshqaruv platformasi: o'quvchilar, to'lovlar, davomat, Telegram bot va hisobotlar bir tizimda.",
      },
      { property: "og:title", content: "UNI CRM — o'quv markazlar uchun boshqaruv tizimi" },
      {
        property: "og:description",
        content: "Markazingizni tanlang yoki UNI CRM'ga ro'yxatdan o'ting — 1 kunda ishga tushadi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UniLanding,
});

const PLANS = [
  { code: "start", name: "Start", price: "490 000", limit: "150 o'quvchi" },
  { code: "pro", name: "Pro", price: "890 000", limit: "400 o'quvchi" },
  { code: "premium", name: "Premium", price: "1 490 000", limit: "1200 o'quvchi" },
] as const;

function UniLanding() {
  const fetchCenters = useServerFn(listPublicCenters);
  const centers = useQuery({
    queryKey: ["uni", "public-centers"],
    queryFn: () => fetchCenters(),
    staleTime: 60_000,
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({
    center_name: "",
    contact_name: "",
    phone: "",
    city: "",
    plan_code: "pro" as (typeof PLANS)[number]["code"],
    students_estimate: "",
    note: "",
  });

  const submit = useServerFn(submitCenterApplication);
  const apply = useMutation({
    mutationFn: () =>
      submit({
        data: {
          center_name: form.center_name.trim(),
          contact_name: form.contact_name.trim(),
          phone: form.phone.trim(),
          city: form.city.trim() || null,
          plan_code: form.plan_code,
          students_estimate: form.students_estimate ? Number(form.students_estimate) : null,
          note: form.note.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Arizangiz qabul qilindi! Tez orada aloqaga chiqamiz.");
      setForm({
        center_name: "",
        contact_name: "",
        phone: "",
        city: "",
        plan_code: "pro",
        students_estimate: "",
        note: "",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-6">
          <img
            src={uniLogo.url}
            alt="UNI CRM logotipi"
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl"
            decoding="async"
          />
          <div className="leading-tight">
            <div className="text-base font-extrabold tracking-[0.18em]">UNI CRM</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              O'quv markazlar platformasi
            </div>
          </div>
          <Link
            to="/auth"
            className="ml-auto rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary"
          >
            Kirish
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
        <section className="grid items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="inline-flex rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Bitta panel — ko'p markaz
            </span>
            <h1 className="mt-4 text-[clamp(2rem,6vw,3.4rem)] font-black leading-[1.05] tracking-tight">
              O'quv markazingizni <span className="text-primary">UNI CRM</span> bilan boshqaring
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
              O'quvchilar, guruhlar, davomat, to'lovlar, oylik hisob-kitob, Telegram bot va
              hisobotlar — hammasi bitta tizimda. Har bir markaz faqat o'z ma'lumotini ko'radi.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#royxat"
                className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg transition hover:opacity-90"
              >
                Ro'yxatdan o'tish
              </a>
              <a
                href="#markazlar"
                className="rounded-xl border border-border px-5 py-3 text-sm font-bold transition hover:border-primary hover:text-primary"
              >
                Markazni tanlash
              </a>
            </div>
          </div>
          <div className="flex justify-center">
            <img
              src={uniLogo.url}
              alt="UNI CRM brend belgisi"
              width={320}
              height={320}
              className="w-[220px] rounded-[2rem] shadow-2xl md:w-[300px]"
              loading="lazy"
              decoding="async"
            />
          </div>
        </section>

        <section id="markazlar" className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight">O'quv markazingizni tanlang</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tizimga kirish uchun markazingizni bosing. Yangi markazlar ro'yxatdan o'tgach shu
            ro'yxatga qo'shiladi.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {centers.isLoading && (
              <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
                Yuklanmoqda...
              </div>
            )}
            {(centers.data ?? []).map((center) => {
              const active = selected === center.id;
              const locked = center.status === "suspended";
              return (
                <button
                  key={center.id}
                  onClick={() => setSelected(center.id)}
                  className={`rounded-2xl border p-5 text-left transition ${
                    active ? "border-primary bg-primary/5 shadow-lg" : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {center.logo_url ? (
                      <img
                        src={center.logo_url}
                        alt={`${center.name} logotipi`}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                        {center.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{center.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {center.address ?? "UNI CRM markazi"}
                      </div>
                    </div>
                  </div>
                  {locked && (
                    <div className="mt-3 text-xs font-semibold text-destructive">
                      Abonent to'lovi kutilmoqda
                    </div>
                  )}
                  {active && (
                    <Link
                      to="/auth"

                      className="mt-4 block rounded-xl bg-primary px-4 py-2 text-center text-sm font-bold text-primary-foreground"
                    >
                      Tizimga kirish
                    </Link>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight">Tariflar</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <div key={plan.code} className="rounded-2xl border border-border bg-card p-5">
                <div className="text-sm font-bold uppercase tracking-[0.2em] text-primary">
                  {plan.name}
                </div>
                <div className="mt-2 text-2xl font-black">
                  {plan.price} <span className="text-sm font-semibold text-muted-foreground">so'm/oy</span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{plan.limit}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="royxat" className="mt-14 rounded-3xl border border-border bg-card p-6 md:p-8">
          <h2 className="text-2xl font-bold tracking-tight">UNI CRM'ga ro'yxatdan o'tish</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ariza yuborasiz — biz markazingizni tizimda ochib, direktor login-parolini beramiz.
          </p>
          <form
            className="mt-5 grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              apply.mutate();
            }}
          >
            <input
              required
              value={form.center_name}
              onChange={(e) => setForm({ ...form, center_name: e.target.value })}
              placeholder="O'quv markaz nomi"
              className="rounded-xl border border-border bg-background px-4 py-3 text-sm"
            />
            <input
              required
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              placeholder="Mas'ul shaxs (F.I.Sh)"
              className="rounded-xl border border-border bg-background px-4 py-3 text-sm"
            />
            <input
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Telefon: +998 90 000 00 00"
              className="rounded-xl border border-border bg-background px-4 py-3 text-sm"
            />
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Shahar / tuman"
              className="rounded-xl border border-border bg-background px-4 py-3 text-sm"
            />
            <select
              value={form.plan_code}
              onChange={(e) =>
                setForm({ ...form, plan_code: e.target.value as (typeof PLANS)[number]["code"] })
              }
              className="rounded-xl border border-border bg-background px-4 py-3 text-sm"
            >
              {PLANS.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name} tarifi
                </option>
              ))}
            </select>
            <input
              inputMode="numeric"
              value={form.students_estimate}
              onChange={(e) =>
                setForm({ ...form, students_estimate: e.target.value.replace(/\D/g, "") })
              }
              placeholder="O'quvchilar soni (taxminan)"
              className="rounded-xl border border-border bg-background px-4 py-3 text-sm"
            />
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Qo'shimcha izoh"
              rows={3}
              className="rounded-xl border border-border bg-background px-4 py-3 text-sm md:col-span-2"
            />
            <button
              type="submit"
              disabled={apply.isPending}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg transition hover:opacity-90 disabled:opacity-60 md:col-span-2"
            >
              {apply.isPending ? "Yuborilmoqda..." : "Arizani yuborish"}
            </button>
          </form>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        UNI CRM — o'quv markazlar uchun yagona boshqaruv platformasi
      </footer>
    </div>
  );
}
