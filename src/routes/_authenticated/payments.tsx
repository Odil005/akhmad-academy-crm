import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Plus, X, Check } from "lucide-react";

type Payment = {
  id: string;
  amount: number;
  period_month: string;
  status: string;
  paid_at: string | null;
  student: { id: string; profile: { full_name: string | null } | null } | null;
};

type StudentOpt = { id: string; profile: { full_name: string | null } | null };

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase
        .from("payments")
        .select("id, amount, period_month, status, paid_at, student:students(id, profile:profiles(full_name))")
        .order("period_month", { ascending: false }),
      supabase.from("students").select("id, profile:profiles(full_name)"),
    ]);
    setPayments((p as never) ?? []);
    setStudents((s as never) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markPaid = async (id: string) => {
    await supabase.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const debt = payments.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">To'lovlar</h1>
          <p className="text-sm text-muted-foreground">Oylik to'lovlarni boshqarish va qarzdorlik</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Yangi to'lov
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Jami hisob-kitob" value={`${total.toLocaleString()} so'm`} />
        <StatCard label="Qarzdorlik" value={`${debt.toLocaleString()} so'm`} tone="danger" />
        <StatCard label="To'lovlar soni" value={`${payments.length}`} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">O'quvchi</th>
                <th className="px-4 py-3">Oy</th>
                <th className="px-4 py-3">Summa</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Yuklanmoqda...</td></tr>}
              {!loading && payments.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Yozuv yo'q</td></tr>
              )}
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">{p.student?.profile?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(p.period_month).toLocaleDateString("uz-UZ", { year: "numeric", month: "long" })}</td>
                  <td className="px-4 py-3 font-semibold">{Number(p.amount).toLocaleString()} so'm</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${p.status === "paid" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                      {p.status === "paid" ? "To'langan" : "Kutilmoqda"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.status !== "paid" && (
                      <button onClick={() => markPaid(p.id)} className="inline-flex items-center gap-1 rounded-lg border border-primary/40 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                        <Check className="h-3 w-3" /> Belgilash
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && <NewPaymentModal students={students} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-2 text-xl font-extrabold ${tone === "danger" ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

function NewPaymentModal({ students, onClose, onDone }: { students: StudentOpt[]; onClose: () => void; onDone: () => void }) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [form, setForm] = useState({ student_id: students[0]?.id ?? "", amount: 400000, period_month: monthStart });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.from("payments").insert({
      student_id: form.student_id,
      amount: form.amount,
      period_month: form.period_month,
      status: "pending",
    });
    if (error) { setError(error.message); setLoading(false); return; }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Yangi to'lov</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">O'quvchi</div>
            <select required value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5">
              <option value="">— Tanlang —</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.profile?.full_name ?? "—"}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Oy</div>
            <input required type="date" value={form.period_month} onChange={(e) => setForm({ ...form, period_month: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
          </label>
          <label className="block text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Summa (so'm)</div>
            <input required type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
          </label>
          {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {loading ? "..." : "Saqlash"}
          </button>
        </form>
      </div>
    </div>
  );
}
