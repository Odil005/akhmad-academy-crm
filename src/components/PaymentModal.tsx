import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  createPaymentWithReceipt,
  getCashierContext,
  resendReceiptTelegram,
} from "@/lib/payments.functions";
import { ReceiptView, type ReceiptData } from "@/components/ReceiptView";
import { X, Search, CheckCircle2, XCircle, Printer, Send, ExternalLink, Loader2, AlertTriangle } from "lucide-react";

type StudentRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  group_id: string | null;
  parent_phone: string | null;
  parent_telegram_chat_id: string | null;
  profile: { full_name: string | null; phone: string | null } | null;
};

type CourseOpt = { id: string; name: string; monthly_fee: number };

type Ctx = Awaited<ReturnType<typeof getCashierContext>>;

const METHODS = [
  { v: "cash", label: "Naqd" },
  { v: "card", label: "Bank kartasi" },
  { v: "qr", label: "QR to'lov" },
  { v: "transfer", label: "Bank o'tkazmasi" },
] as const;

const fmt = (n: number) => Number(n || 0).toLocaleString("uz-UZ");
const nameOf = (s: StudentRow) =>
  s.profile?.full_name || [s.last_name, s.first_name].filter(Boolean).join(" ") || "O'quvchi";

export function PaymentModal({ onClose, onDone, initialStudentId }: { onClose: () => void; onDone: () => void; initialStudentId?: string }) {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [query, setQuery] = useState("");
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [courseId, setCourseId] = useState<string>("");

  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [subtotal, setSubtotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]["v"]>("cash");
  const [cashAccountId, setCashAccountId] = useState<string>("");
  const [fiscalize, setFiscalize] = useState(true);
  const [notify, setNotify] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ paymentId: string; fiscalError: string | null; notifStatus: string | null } | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [idemKey] = useState(() => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`));

  useEffect(() => {
    getCashierContext()
      .then((c) => {
        setCtx(c);
        const accs = (c as any)?.cashAccounts ?? [];
        if (accs[0]) setCashAccountId(accs[0].id);
      })
      .catch(() => setCtx(null));
    supabase
      .from("students")
      .select("id, first_name, last_name, group_id, parent_phone, parent_telegram_chat_id, profile:profiles(full_name, phone)")
      .order("enrolled_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        const list = ((data as never) ?? []) as StudentRow[];
        setStudents(list);
        if (initialStudentId) {
          const pre = list.find((x) => x.id === initialStudentId);
          if (pre) setStudent(pre);
        }
      });
  }, [initialStudentId]);

  useEffect(() => {
    if (!student) { setCourses([]); setCourseId(""); return; }
    (async () => {
      const { data: enr } = await supabase
        .from("student_enrollments")
        .select("group_id, monthly_fee, status, group:groups(id, name, monthly_fee)")
        .eq("student_id", student.id)
        .eq("status", "active");
      let list: CourseOpt[] = ((enr ?? []) as never[])
        .map((e: any) => e.group ? { id: e.group.id, name: e.group.name, monthly_fee: Number(e.monthly_fee ?? e.group.monthly_fee ?? 0) } : null)
        .filter(Boolean) as CourseOpt[];
      if (list.length === 0 && student.group_id) {
        const { data: g } = await supabase.from("groups").select("id, name, monthly_fee").eq("id", student.group_id).maybeSingle();
        if (g) list = [{ id: g.id, name: g.name, monthly_fee: Number(g.monthly_fee ?? 0) }];
      }
      setCourses(list);
      if (list[0]) { setCourseId(list[0].id); setSubtotal(list[0].monthly_fee); }
    })();
  }, [student]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students.slice(0, 8);
    return students.filter((s) => {
      const phone = `${s.parent_phone ?? ""} ${s.profile?.phone ?? ""}`;
      return nameOf(s).toLowerCase().includes(q) || phone.includes(q);
    }).slice(0, 8);
  }, [students, query]);

  const total = Math.max(0, subtotal - discount);

  const submit = async () => {
    if (!student) { setError("O'quvchini tanlang"); return; }
    if (total <= 0) { setError("Summa noldan katta bo'lishi kerak"); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await createPaymentWithReceipt({
        data: {
          student_id: student.id,
          course_id: courseId || null,
          period_month: `${period}-01`,
          subtotal,
          discount_amount: discount,
          discount_reason: discount > 0 ? (discountReason || null) : null,
          payment_method: method,
          cash_account_id: cashAccountId || null,
          fiscalize,
          notify_parent: notify,
          idempotency_key: idemKey,
        },
      });
      const r = res as any;
      setResult({
        paymentId: r.payment.id,
        fiscalError: r.fiscalError ?? null,
        notifStatus: r.notification?.status ?? null,
      });
      const { getPublicReceipt } = await import("@/lib/payments.functions");
      const rec = await getPublicReceipt({ data: { payment_id: r.payment.id } });
      setReceipt(rec as unknown as ReceiptData);
      onDone();
    } catch (e) {
      setError(errText(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:items-center sm:p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-bold sm:text-lg">To'lov qabul qilish</h2>
          <button onClick={onClose} aria-label="Yopish" className="rounded-lg p-1 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        {result ? (
          <SuccessPanel
            paymentId={result.paymentId}
            fiscalError={result.fiscalError}
            notifStatus={result.notifStatus}
            receipt={receipt}
            onClose={onClose}
          />
        ) : (
          <div className="space-y-5 px-5 py-5">
            <HealthStrip ctx={ctx} />

            {/* student */}
            <Field label="O'quvchi">
              {student ? (
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                  <div>
                    <div className="text-sm font-semibold">{nameOf(student)}</div>
                    <div className="text-xs text-muted-foreground">
                      {student.parent_phone ?? student.profile?.phone ?? "telefon yo'q"} ·{" "}
                      {student.parent_telegram_chat_id ? "Telegram ulangan" : "Telegram ulanmagan"}
                    </div>
                  </div>
                  <button onClick={() => setStudent(null)} className="text-xs font-semibold text-primary">O'zgartirish</button>
                </div>
              ) : (
                <div className="rounded-lg border border-border">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                      autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                      placeholder="Ism yoki telefon raqami"
                      className="w-full bg-transparent text-sm outline-none"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto border-t border-border">
                    {filtered.length === 0 && <div className="px-3 py-3 text-xs text-muted-foreground">Topilmadi</div>}
                    {filtered.map((s) => (
                      <button key={s.id} onClick={() => setStudent(s)} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-secondary/50">
                        <span className="text-sm">{nameOf(s)}</span>
                        <span className="text-xs text-muted-foreground">{s.parent_phone ?? ""}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kurs">
                <select value={courseId} onChange={(e) => {
                  setCourseId(e.target.value);
                  const c = courses.find((x) => x.id === e.target.value);
                  if (c) setSubtotal(c.monthly_fee);
                }} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                  <option value="">— Tanlanmagan —</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>

              <Field label="To'lov davri">
                <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
              </Field>

              <Field label="To'lov miqdori (so'm)">
                <input type="number" min={0} value={subtotal} onChange={(e) => setSubtotal(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-semibold" />
              </Field>

              <Field label="To'lov turi">
                <select value={method} onChange={(e) => setMethod(e.target.value as never)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                  {METHODS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
                </select>
              </Field>

              <Field label="Kassa hisobi">
                {((ctx as any)?.cashAccounts ?? []).length > 0 ? (
                  <select value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                    {((ctx as any).cashAccounts as { id: string; name: string }[]).map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                ) : (
                  <a href="/finance" className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs font-semibold text-amber-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" /> Kassa hisobi yo'q — Moliya bo'limida yarating
                  </a>
                )}
              </Field>



              {ctx?.canDiscount && (
                <>
                  <Field label="Chegirma (so'm)">
                    <input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
                  </Field>
                  <Field label="Chegirma sababi">
                    <input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="Masalan: aka-uka chegirmasi"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
                  </Field>
                </>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
              <span className="text-sm font-semibold text-muted-foreground">To'lanadigan summa</span>
              <span className="text-xl font-extrabold text-primary">{fmt(total)} so'm</span>
            </div>

            <div className="space-y-2">
              <Toggle checked={fiscalize} onChange={setFiscalize} label="Fiskal chek chiqarish" />
              <Toggle checked={notify} onChange={setNotify} label="Ota-onaga Telegram orqali yuborish" />
            </div>

            {error && (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary">
                Bekor qilish
              </button>
              <button onClick={submit} disabled={submitting || !student}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                To'lovni tasdiqlash va chek chiqarish
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function errText(e: unknown): string {
  if (e instanceof Response) return `Xato (${e.status})`;
  const m = (e as Error)?.message ?? "";
  return m || "Kutilmagan xato";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}

function HealthStrip({ ctx }: { ctx: Ctx | null }) {
  if (!ctx) return <div className="h-9 animate-pulse rounded-lg bg-secondary/50" />;
  const items = [
    { ok: ctx.printer.type !== "none", label: ctx.printer.type === "none" ? "Printer sozlanmagan" : "Printer tayyor" },
    { ok: ctx.fiscal.real && ctx.fiscal.shiftOpen, label: ctx.fiscal.real ? (ctx.fiscal.shiftOpen ? "Virtual kassa faol" : "Kassa smenasi yopiq") : `Test rejim — ${ctx.fiscal.reason ?? "fiskal emas"}` },
    { ok: ctx.telegram.configured, label: ctx.telegram.configured ? "Telegram bot faol" : "Telegram bot sozlanmagan" },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${i.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
          {i.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
          <span className="truncate">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

function SuccessPanel({ paymentId, fiscalError, notifStatus, receipt, onClose }: {
  paymentId: string; fiscalError: string | null; notifStatus: string | null; receipt: ReceiptData | null; onClose: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isFiscal = receipt?.receipt && !receipt.receipt.test_mode && receipt.payment.fiscal_status === "fiscalized";

  const resend = async () => {
    setBusy(true); setMsg(null);
    try { await resendReceiptTelegram({ data: { payment_id: paymentId } }); setMsg("Telegramga yuborildi"); }
    catch { setMsg("Yuborilmadi — navbatda saqlandi"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 px-5 py-5">
      {fiscalError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="font-bold">Virtual kassa bilan aloqa o'rnatilmadi</div>
          <div className="mt-1 text-xs">To'lov saqlandi, lekin fiskal chek yaratilmadi. To'lovlar ro'yxatidan «Qayta fiskallashtirish» tugmasini bosing.</div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-700">
          <div className="font-bold">To'lov qabul qilindi</div>
          {isFiscal ? (
            <div className="mt-1 text-xs">Fiskal chek yaratildi. Ota-ona QR-kodni Soliq ilovasida ro'yxatdan o'tkazsa 1% keshbek oladi.</div>
          ) : (
            <div className="mt-1 text-xs">Test rejim: chek fiskal emas.</div>
          )}
        </div>
      )}

      {notifStatus && notifStatus !== "sent" && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700">
          Telegram xabari yuborilmadi — navbatda saqlandi.
        </p>
      )}

      {receipt && (
        <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-border bg-white p-2">
          <ReceiptView data={receipt} />
        </div>
      )}

      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}

      <div className="flex flex-wrap gap-2">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
          <Printer className="h-4 w-4" /> Chekni chiqarish
        </button>
        <a href={`/receipt/${paymentId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary">
          <ExternalLink className="h-4 w-4" /> Chekni ochish
        </a>
        <button onClick={resend} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-60">
          <Send className="h-4 w-4" /> Telegramga qayta yuborish
        </button>
        <button onClick={onClose} className="ml-auto rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary">Yopish</button>
      </div>
    </div>
  );
}
