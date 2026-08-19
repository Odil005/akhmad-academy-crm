import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Printer, Send, ExternalLink, RotateCcw, RefreshCw, Undo2 } from "lucide-react";
import { PaymentModal } from "@/components/PaymentModal";
import { retryFiscalization, resendReceiptTelegram, refundPayment, getCashierContext } from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
});

type Row = {
  id: string;
  amount: number;
  total_amount: number | null;
  period_month: string;
  status: string;
  fiscal_status: string;
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
  cashier_id: string | null;
  course_id: string | null;
  student: { id: string; first_name: string | null; last_name: string | null; profile: { full_name: string | null } | null } | null;
  course: { id: string; name: string } | null;
};

const METHOD_LABEL: Record<string, string> = { cash: "Naqd", card: "Karta", qr: "QR", transfer: "O'tkazma" };
const FISCAL_LABEL: Record<string, string> = {
  draft: "Fiskalsiz", processing: "Jarayonda", fiscalized: "Fiskal chek",
  fiscal_failed: "Fiskal xato", refunded: "Qaytarilgan", cancelled: "Bekor qilingan",
};
const fmt = (n: number) => Number(n || 0).toLocaleString("uz-UZ");

function PaymentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [receipts, setReceipts] = useState<Record<string, { test_mode: boolean; receipt_url: string | null; receipt_number: string | null }>>({});
  const [notifs, setNotifs] = useState<Record<string, string>>({});
  const [cashiers, setCashiers] = useState<Record<string, string>>({});
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isDirector, setIsDirector] = useState(false);

  const [f, setF] = useState({ from: "", to: "", course: "", method: "", fiscal: "", cashier: "" });

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: r }, { data: n }, { data: c }, { data: pr }] = await Promise.all([
      supabase.from("payments")
        .select("id, amount, total_amount, period_month, status, fiscal_status, payment_method, paid_at, created_at, cashier_id, course_id, student:students(id, first_name, last_name, profile:profiles(full_name)), course:groups!payments_course_id_fkey(id, name)")
        .order("created_at", { ascending: false }).limit(500),
      supabase.from("fiscal_receipts").select("payment_id, test_mode, receipt_url, receipt_number"),
      supabase.from("notification_queue").select("payment_id, status, created_at").order("created_at", { ascending: false }),
      supabase.from("groups").select("id, name"),
      supabase.from("profiles").select("id, full_name"),
    ]);
    setRows((p as never) ?? []);
    const rm: Record<string, any> = {};
    for (const x of (r ?? []) as any[]) rm[x.payment_id] = x;
    setReceipts(rm);
    const nm: Record<string, string> = {};
    for (const x of (n ?? []) as any[]) if (x.payment_id && !nm[x.payment_id]) nm[x.payment_id] = x.status;
    setNotifs(nm);
    setCourses((c ?? []) as { id: string; name: string }[]);
    const cm: Record<string, string> = {};
    for (const x of (pr ?? []) as any[]) cm[x.id] = x.full_name ?? "—";
    setCashiers(cm);
    setLoading(false);
  };

  useDataEvent("groups", () => {
    void load();
  });

  useEffect(() => {
    load();
    getCashierContext().then((x) => setIsDirector(!!x.isDirector)).catch(() => setIsDirector(false));
  }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    const d = (r.paid_at ?? r.created_at).slice(0, 10);
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
    if (f.course && r.course_id !== f.course) return false;
    if (f.method && r.payment_method !== f.method) return false;
    if (f.fiscal && r.fiscal_status !== f.fiscal) return false;
    if (f.cashier && r.cashier_id !== f.cashier) return false;
    return true;
  }), [rows, f]);

  const total = filtered.reduce((s, r) => s + Number(r.total_amount || r.amount), 0);
  const fiscalCount = filtered.filter((r) => r.fiscal_status === "fiscalized").length;

  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id); setToast(null);
    try { await fn(); setToast(ok); await load(); }
    catch (e) { setToast((e as Error)?.message || "Amal bajarilmadi"); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">To'lovlar</h1>
          <p className="text-sm text-muted-foreground">Kassa, fiskal cheklar va ota-onaga xabarlar</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> To'lov qabul qilish
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat label="Jami tushum" value={`${fmt(total)} so'm`} />
        <Stat label="Fiskal cheklar" value={`${fiscalCount}`} />
        <Stat label="To'lovlar soni" value={`${filtered.length}`} />
      </div>

      {/* filters */}
      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6">
        <FInput label="Sanadan" type="date" value={f.from} onChange={(v) => setF({ ...f, from: v })} />
        <FInput label="Sanagacha" type="date" value={f.to} onChange={(v) => setF({ ...f, to: v })} />
        <FSelect label="Kurs" value={f.course} onChange={(v) => setF({ ...f, course: v })} options={courses.map((c) => ({ v: c.id, l: c.name }))} />
        <FSelect label="To'lov turi" value={f.method} onChange={(v) => setF({ ...f, method: v })} options={Object.entries(METHOD_LABEL).map(([v, l]) => ({ v, l }))} />
        <FSelect label="Fiskal holat" value={f.fiscal} onChange={(v) => setF({ ...f, fiscal: v })} options={Object.entries(FISCAL_LABEL).map(([v, l]) => ({ v, l }))} />
        <FSelect label="Kassir" value={f.cashier} onChange={(v) => setF({ ...f, cashier: v })} options={Object.entries(cashiers).map(([v, l]) => ({ v, l }))} />
      </div>

      {toast && <p className="rounded-lg border border-border bg-secondary/40 p-3 text-xs">{toast}</p>}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-border bg-secondary/30 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">O'quvchi</th>
                <th className="px-4 py-3">Kurs</th>
                <th className="px-4 py-3">Davr</th>
                <th className="px-4 py-3">Summa</th>
                <th className="px-4 py-3">Turi</th>
                <th className="px-4 py-3">Fiskal</th>
                <th className="px-4 py-3">Telegram</th>
                <th className="px-4 py-3">Kassir</th>
                <th className="px-4 py-3">Sana</th>
                <th className="px-4 py-3 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && <tr><td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">Yuklanmoqda...</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">Yozuv yo'q</td></tr>}
              {filtered.map((r) => {
                const rec = receipts[r.id];
                const name = r.student?.profile?.full_name || [r.student?.last_name, r.student?.first_name].filter(Boolean).join(" ") || "—";
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium">{name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.course?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(r.period_month).toLocaleDateString("uz-UZ", { year: "numeric", month: "short" })}</td>
                    <td className="px-4 py-3 font-semibold">{fmt(Number(r.total_amount || r.amount))}</td>
                    <td className="px-4 py-3 text-muted-foreground">{METHOD_LABEL[r.payment_method ?? ""] ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={r.fiscal_status === "fiscalized" ? (rec?.test_mode ? "warn" : "ok") : r.fiscal_status === "fiscal_failed" ? "bad" : "muted"}>
                        {r.fiscal_status === "fiscalized" && rec?.test_mode ? "TEST" : FISCAL_LABEL[r.fiscal_status] ?? r.fiscal_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={notifs[r.id] === "sent" ? "ok" : notifs[r.id] ? "warn" : "muted"}>
                        {notifs[r.id] === "sent" ? "Yuborildi" : notifs[r.id] === "pending" ? "Navbatda" : notifs[r.id] ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.cashier_id ? cashiers[r.cashier_id] ?? "—" : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(r.paid_at ?? r.created_at).toLocaleDateString("uz-UZ")}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <IconBtn title="Chekni ko'rish" href={`/receipt/${r.id}`}><ExternalLink className="h-3.5 w-3.5" /></IconBtn>
                        <IconBtn title="Chekni chiqarish" href={`/receipt/${r.id}`}><Printer className="h-3.5 w-3.5" /></IconBtn>
                        <IconBtn title="Telegramga qayta yuborish" disabled={busy === r.id}
                          onClick={() => act(r.id, () => resendReceiptTelegram({ data: { payment_id: r.id } }), "Telegramga yuborildi")}>
                          <Send className="h-3.5 w-3.5" />
                        </IconBtn>
                        {r.fiscal_status === "fiscal_failed" && (
                          <IconBtn title="Qayta fiskallashtirish" disabled={busy === r.id}
                            onClick={() => act(r.id, () => retryFiscalization({ data: { payment_id: r.id } }), "Fiskal chek yaratildi")}>
                            {busy === r.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          </IconBtn>
                        )}
                        {isDirector && r.fiscal_status !== "refunded" && (
                          <IconBtn title="Qaytarish (director)" disabled={busy === r.id}
                            onClick={() => {
                              const reason = window.prompt("Qaytarish sababi:");
                              if (reason && reason.length >= 3) act(r.id, () => refundPayment({ data: { payment_id: r.id, reason } }), "Qaytarildi");
                            }}>
                            <Undo2 className="h-3.5 w-3.5" />
                          </IconBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {open && <PaymentModal onClose={() => setOpen(false)} onDone={load} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-extrabold">{value}</div>
    </div>
  );
}

function Badge({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted"; children: React.ReactNode }) {
  const cls = tone === "ok" ? "bg-emerald-500/15 text-emerald-700"
    : tone === "warn" ? "bg-amber-500/15 text-amber-700"
    : tone === "bad" ? "bg-destructive/15 text-destructive"
    : "bg-secondary text-muted-foreground";
  return <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
}

function IconBtn({ title, children, onClick, href, disabled }: { title: string; children: React.ReactNode; onClick?: () => void; href?: string; disabled?: boolean }) {
  const cls = "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border hover:bg-secondary disabled:opacity-50";
  if (href) return <a title={title} href={href} target="_blank" rel="noreferrer" className={cls}>{children}</a>;
  return <button title={title} onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}

function FInput({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type: string }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
    </label>
  );
}

function FSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
        <option value="">Hammasi</option>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}
