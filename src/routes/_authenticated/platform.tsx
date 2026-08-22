import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  Plus,
  ReceiptText,
  ShieldCheck,
  Unlock,
  Users,
} from "lucide-react";
import {
  claimPlatformOwner,
  createCenter,
  generateCenterInvoice,
  getPlatformAccess,
  getPlatformOverview,
  recordCenterPayment,
  setApplicationStatus,
  setCenterStatus,
} from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/platform")({
  component: PlatformPage,
  head: () => ({
    meta: [
      { title: "UNI CRM platforma paneli — ko'p tarmoqli boshqaruv" },
      {
        name: "description",
        content:
          "UNI CRM platforma egasi paneli: o'quv markazlar, tariflar, oylik abonent to'lovlari, arizalar va cheklovlar bir joyda.",
      },
      { property: "og:title", content: "UNI CRM platforma paneli" },
      {
        property: "og:description",
        content: "Ko'p tarmoqli o'quv markazlarni bitta paneldan boshqaring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const money = (v: number) => Number(v || 0).toLocaleString("uz-UZ");

const STATUS_META: Record<string, { label: string; className: string }> = {
  active: { label: "Faol", className: "bg-emerald-500/15 text-emerald-300" },
  grace: { label: "Ogohlantirish", className: "bg-amber-500/15 text-amber-300" },
  suspended: { label: "Bloklangan", className: "bg-rose-500/15 text-rose-300" },
  archived: { label: "Arxiv", className: "bg-muted text-muted-foreground" },
};

function PlatformPage() {
  const queryClient = useQueryClient();
  const fetchAccess = useServerFn(getPlatformAccess);
  const fetchOverview = useServerFn(getPlatformOverview);
  const claimOwner = useServerFn(claimPlatformOwner);
  const addCenter = useServerFn(createCenter);
  const updateCenterStatus = useServerFn(setCenterStatus);
  const updateApplication = useServerFn(setApplicationStatus);
  const addPayment = useServerFn(recordCenterPayment);
  const makeInvoice = useServerFn(generateCenterInvoice);

  const access = useQuery({ queryKey: ["platform", "access"], queryFn: () => fetchAccess() });
  const overview = useQuery({
    queryKey: ["platform", "overview"],
    queryFn: () => fetchOverview(),
    enabled: Boolean(access.data?.isOwner),
  });

  const [form, setForm] = useState({ name: "", slug: "", phone: "", address: "", plan_id: "" });
  const [payFor, setPayFor] = useState<{ id: string; name: string; price: number } | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", months: "1", note: "" });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["platform"] });

  const claim = useMutation({
    mutationFn: () => claimOwner(),
    onSuccess: () => {
      toast.success("Siz platforma egasi bo'ldingiz");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: () =>
      addCenter({
        data: {
          name: form.name.trim(),
          slug: form.slug.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          plan_id: form.plan_id || null,
        },
      }),
    onSuccess: () => {
      toast.success("Yangi o'quv markaz qo'shildi");
      setForm({ name: "", slug: "", phone: "", address: "", plan_id: "" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { center_id: string; status: "active" | "suspended" }) =>
      updateCenterStatus({ data: input }),
    onSuccess: () => {
      toast.success("Markaz holati yangilandi");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invoiceMutation = useMutation({
    mutationFn: (center_id: string) => makeInvoice({ data: { center_id } }),
    onSuccess: (res: { created: boolean }) => {
      toast.success(res.created ? "Hisob-faktura yaratildi" : "Bu oy uchun faktura mavjud");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const appMutation = useMutation({
    mutationFn: (input: { id: string; status: "contacted" | "rejected" }) =>
      updateApplication({ data: input }),
    onSuccess: () => {
      toast.success("Ariza holati yangilandi");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payMutation = useMutation({
    mutationFn: () =>
      addPayment({
        data: {
          center_id: payFor!.id,
          amount: Number(payForm.amount || payFor!.price || 0),
          months: Number(payForm.months || 1),
          note: payForm.note.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("To'lov kiritildi, abonent uzaytirildi");
      setPayFor(null);
      setPayForm({ amount: "", months: "1", note: "" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (access.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda…
      </div>
    );
  }

  if (!access.data?.isOwner) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
        <h1 className="text-xl font-extrabold">UNI CRM platforma paneli</h1>
        <p className="text-sm text-muted-foreground">
          Bu bo'lim faqat platforma egasi uchun. Agar bu tizim sizga tegishli bo'lsa, egalikni bir
          marta o'zingizga biriktirishingiz mumkin.
        </p>
        {(access.data?.ownerCount ?? 0) === 0 ? (
          <button
            onClick={() => claim.mutate()}
            disabled={claim.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {claim.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Egalikni olish
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">Platforma egasi allaqachon belgilangan.</p>
        )}
      </div>
    );
  }

  const data = overview.data;
  const pendingApps = (data?.applications ?? []).filter((a: any) => a.status === "pending");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">UNI CRM platforma</h1>
          <p className="text-sm text-muted-foreground">
            Ko'p tarmoqli o'quv markazlar, tariflar va oylik abonent nazorati.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-2 text-right">
          <p className="text-xs text-muted-foreground">Oylik tushum (MRR)</p>
          <p className="text-xl font-extrabold text-primary">{money(data?.mrr ?? 0)} so'm</p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Building2} label="Markazlar" value={String(data?.centers.length ?? 0)} />
        <StatCard
          icon={Users}
          label="Jami o'quvchi"
          value={String((data?.centers ?? []).reduce((s: number, c: any) => s + (c.students ?? 0), 0))}
        />
        <StatCard
          icon={ReceiptText}
          label="Qarzdor markazlar"
          value={String((data?.centers ?? []).filter((c: any) => Number(c.debt) > 0).length)}
        />
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <Plus className="h-4 w-4" /> Yangi o'quv markaz
        </h2>
        <div className="grid gap-2 md:grid-cols-5">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Markaz nomi"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="slug (ixtiyoriy)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Telefon"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={form.plan_id}
            onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Tarif tanlang</option>
            {(data?.plans ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name} — {money(p.monthly_price)} so'm
              </option>
            ))}
          </select>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || form.name.trim().length < 2}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Qo'shish
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-bold">Markazlar</div>
        {overview.isLoading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda…
          </div>
        ) : (data?.centers.length ?? 0) === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Hozircha markaz yo'q.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Markaz</th>
                  <th className="px-4 py-2 text-left">Holat</th>
                  <th className="px-4 py-2 text-right">O'quvchi</th>
                  <th className="px-4 py-2 text-right">Oylik</th>
                  <th className="px-4 py-2 text-left">Muddat</th>
                  <th className="px-4 py-2 text-right">Qarz</th>
                  <th className="px-4 py-2 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {(data?.centers ?? []).map((c: any) => {
                  const meta = STATUS_META[c.status] ?? STATUS_META.active!;
                  return (
                    <tr key={c.id} className="border-t border-border/60">
                      <td className="px-4 py-2">
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.slug ?? "—"}</p>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${meta.className}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {c.students} / {c.student_limit}
                      </td>
                      <td className="px-4 py-2 text-right">{money(c.monthly_price)}</td>
                      <td className="px-4 py-2">{c.period_end ?? "—"}</td>
                      <td className={`px-4 py-2 text-right ${Number(c.debt) > 0 ? "text-rose-300" : ""}`}>
                        {money(c.debt)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap justify-end gap-1">
                          <button
                            onClick={() => invoiceMutation.mutate(c.id)}
                            className="rounded-md border border-border px-2 py-1 text-xs font-semibold hover:border-primary/60"
                          >
                            Faktura
                          </button>
                          <button
                            onClick={() => {
                              setPayFor({ id: c.id, name: c.name, price: Number(c.monthly_price) });
                              setPayForm({ amount: String(c.monthly_price ?? ""), months: "1", note: "" });
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
                          >
                            <CreditCard className="h-3 w-3" /> To'lov
                          </button>
                          {c.status === "suspended" ? (
                            <button
                              onClick={() => statusMutation.mutate({ center_id: c.id, status: "active" })}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 px-2 py-1 text-xs font-semibold text-emerald-300"
                            >
                              <Unlock className="h-3 w-3" /> Ochish
                            </button>
                          ) : (
                            <button
                              onClick={() => statusMutation.mutate({ center_id: c.id, status: "suspended" })}
                              className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 px-2 py-1 text-xs font-semibold text-rose-300"
                            >
                              <Lock className="h-3 w-3" /> Bloklash
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Yangi arizalar ({pendingApps.length})
        </h2>
        {pendingApps.length === 0 ? (
          <p className="text-sm text-muted-foreground">Yangi ariza yo'q.</p>
        ) : (
          <ul className="space-y-2">
            {pendingApps.map((a: any) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 p-3"
              >
                <div>
                  <p className="font-semibold">{a.center_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.contact_name} · {a.phone} · {a.city ?? "—"} · {a.plan_code ?? "tarif tanlanmagan"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      create.mutate(undefined, {
                        onSuccess: () => undefined,
                      })
                    }
                    className="hidden"
                  />
                  <button
                    onClick={() =>
                      addCenter({
                        data: {
                          name: a.center_name,
                          phone: a.phone,
                          application_id: a.id,
                          plan_id:
                            (data?.plans ?? []).find((p: any) => p.code === a.plan_code)?.id ?? null,
                        },
                      })
                        .then(() => {
                          toast.success("Ariza tasdiqlandi, markaz ochildi");
                          refresh();
                        })
                        .catch((e: Error) => toast.error(e.message))
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Tasdiqlash
                  </button>
                  <button
                    onClick={() => appMutation.mutate({ id: a.id, status: "contacted" })}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold"
                  >
                    Bog'lanildi
                  </button>
                  <button
                    onClick={() => appMutation.mutate({ id: a.id, status: "rejected" })}
                    className="rounded-md border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-300"
                  >
                    Rad etish
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {payFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-card p-5">
            <h3 className="text-lg font-bold">{payFor.name} — to'lov</h3>
            <input
              value={payForm.amount}
              onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
              placeholder="Summa"
              inputMode="numeric"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={payForm.months}
              onChange={(e) => setPayForm({ ...payForm, months: e.target.value })}
              placeholder="Necha oy"
              inputMode="numeric"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={payForm.note}
              onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
              placeholder="Izoh (ixtiyoriy)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setPayFor(null)}
                className="rounded-lg border border-border px-3 py-2 text-sm font-semibold"
              >
                Bekor
              </button>
              <button
                onClick={() => payMutation.mutate()}
                disabled={payMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {payMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="rounded-xl bg-primary/10 p-2 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-extrabold">{value}</p>
      </div>
    </div>
  );
}
