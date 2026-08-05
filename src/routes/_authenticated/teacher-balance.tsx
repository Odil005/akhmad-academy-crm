import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wallet, Plus, Calculator } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher-balance")({
  beforeLoad: ({ context }) => {
    const roles = (context as any).roles as string[];
    if (!roles?.includes("director")) throw redirect({ to: "/dashboard" });
  },
  component: TeacherBalancePage,
});

type Teacher = { user_id: string; full_name: string | null };

function TeacherBalancePage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [pays, setPays] = useState<any[]>([]);
  const [revenueMap, setRevenueMap] = useState<Record<string, number>>({});
  const [form, setForm] = useState({
    teacher_user_id: "",
    period_month: new Date().toISOString().slice(0, 7) + "-01",
    salary: 0, bonus: 0, penalty: 0, kpi_score: 0,
    percent: 0, revenue_base: 0, percent_earning: 0,
    visible_to_teacher: false,
  });
  const [payForm, setPayForm] = useState({ teacher_user_id: "", amount: 0, note: "" });

  const load = async () => {
    const { data: tRoles } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
    const teacherIds = (tRoles ?? []).map((r: any) => r.user_id);
    if (teacherIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", teacherIds);
      setTeachers((profs ?? []).map((p: any) => ({ user_id: p.id, full_name: p.full_name })));
    }
    const [{ data: b }, { data: p }] = await Promise.all([
      supabase.from("teacher_balance").select("id, teacher_user_id, period_month, salary, bonus, penalty, kpi_score, percent, revenue_base, percent_earning, note, visible_to_teacher").order("period_month", { ascending: false }).limit(200),
      supabase.from("teacher_salary_payments").select("id, teacher_user_id, amount, paid_at, note").order("paid_at", { ascending: false }).limit(30),
    ]);
    setRows(b ?? []); setPays(p ?? []);
  };
  useEffect(() => { load(); }, []);

  // Auto-compute revenue for selected teacher + month.
  useEffect(() => {
    (async () => {
      if (!form.teacher_user_id || !form.period_month) return;
      const monthStart = form.period_month; // YYYY-MM-01
      const d = new Date(monthStart);
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10);

      // Find groups taught by this teacher, then sum paid payments in period for those students.
      const { data: grps } = await supabase.from("groups").select("id").eq("teacher_id", form.teacher_user_id);
      const groupIds = (grps ?? []).map((g: any) => g.id);
      let revenue = 0;
      if (groupIds.length) {
        // Students in those groups (direct + enrollments)
        const [{ data: directStudents }, { data: enrolled }] = await Promise.all([
          supabase.from("students").select("id").in("group_id", groupIds),
          supabase.from("student_enrollments").select("student_id").in("group_id", groupIds),
        ]);
        const sIds = Array.from(new Set([
          ...(directStudents ?? []).map((s: any) => s.id),
          ...(enrolled ?? []).map((e: any) => e.student_id),
        ]));
        if (sIds.length) {
          const { data: payments } = await supabase
            .from("payments").select("amount, status, period_month")
            .in("student_id", sIds).eq("status", "paid")
            .gte("period_month", monthStart).lt("period_month", nextMonth);
          revenue = (payments ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
        }
      }
      setRevenueMap((m) => ({ ...m, [`${form.teacher_user_id}:${monthStart}`]: revenue }));
      setForm((f) => ({
        ...f,
        revenue_base: revenue,
        percent_earning: Math.round(revenue * Number(f.percent || 0) / 100),
      }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.teacher_user_id, form.period_month]);

  // Recompute earning when percent changes.
  useEffect(() => {
    setForm((f) => ({ ...f, percent_earning: Math.round(Number(f.revenue_base) * Number(f.percent || 0) / 100) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.percent]);

  const nameOf = (uid: string) => teachers.find((t) => t.user_id === uid)?.full_name ?? uid.slice(0, 6);

  const saveBalance = async () => {
    if (!form.teacher_user_id) return toast.error("O'qituvchi tanlang");
    const { error } = await supabase.from("teacher_balance").upsert(form, { onConflict: "teacher_user_id,period_month" });
    if (error) toast.error(error.message); else { toast.success("Saqlandi"); load(); }
  };
  const payOut = async () => {
    if (!payForm.teacher_user_id || !payForm.amount) return;
    const { error } = await supabase.from("teacher_salary_payments").insert(payForm);
    if (error) toast.error(error.message); else { toast.success("To'landi"); setPayForm({ teacher_user_id: "", amount: 0, note: "" }); load(); }
  };

  const totalOwed = useMemo(() => {
    // Sum of salary+bonus+percent_earning - penalty across the visible rows
    return rows.reduce((s, r) => s + Number(r.salary) + Number(r.bonus) + Number(r.percent_earning ?? 0) - Number(r.penalty), 0);
  }, [rows]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold md:text-3xl">
          <Wallet className="h-6 w-6 text-primary" /> O'qituvchi balansi
        </h1>
        <p className="text-sm text-muted-foreground">Faqat Director ko'ra oladi · Jami balans: <b>{totalOwed.toLocaleString()} so'm</b></p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-bold">Oylik balans qo'shish / yangilash</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 block text-sm">
              <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">O'qituvchi</div>
              <select value={form.teacher_user_id} onChange={(e) => setForm({ ...form, teacher_user_id: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5">
                <option value="">— tanlang —</option>
                {teachers.map((t) => <option key={t.user_id} value={t.user_id}>{t.full_name || t.user_id.slice(0, 8)}</option>)}
              </select>
            </label>
            <NumField label="Oy (YYYY-MM-01)" value={form.period_month as any} onChange={(v) => setForm({ ...form, period_month: v as any })} type="text" />
            <NumField label="Oylik" value={form.salary} onChange={(v) => setForm({ ...form, salary: Number(v) })} />
            <NumField label="Bonus" value={form.bonus} onChange={(v) => setForm({ ...form, bonus: Number(v) })} />
            <NumField label="Jarima" value={form.penalty} onChange={(v) => setForm({ ...form, penalty: Number(v) })} />
            <NumField label="KPI" value={form.kpi_score} onChange={(v) => setForm({ ...form, kpi_score: Number(v) })} />

            <div className="col-span-2 mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-primary">
                <Calculator className="h-3.5 w-3.5" /> Foiz hisoblash
              </div>
              <div className="grid grid-cols-3 gap-2">
                <NumField label="Foiz %" value={form.percent} onChange={(v) => setForm({ ...form, percent: Number(v) })} />
                <NumField label="Tushum asosi" value={form.revenue_base} onChange={(v) => setForm({ ...form, revenue_base: Number(v) })} />
                <NumField label="Foizdan daromad" value={form.percent_earning} onChange={(v) => setForm({ ...form, percent_earning: Number(v) })} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Tushum bu o'qituvchi guruhlaridagi o'quvchilarning shu oydagi to'langan to'lovlar yig'indisi. Foizni yozing — daromad avtomatik hisoblanadi.
              </p>
            </div>

            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.visible_to_teacher} onChange={(e) => setForm({ ...form, visible_to_teacher: e.target.checked })} />
              O'qituvchiga ko'rsat
            </label>
          </div>
          <button onClick={saveBalance} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            <Plus className="h-4 w-4" /> Saqlash
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-bold">Oylikni to'lash</h2>
          <div className="space-y-3">
            <select value={payForm.teacher_user_id} onChange={(e) => setPayForm({ ...payForm, teacher_user_id: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
              <option value="">— o'qituvchi —</option>
              {teachers.map((t) => <option key={t.user_id} value={t.user_id}>{t.full_name || t.user_id.slice(0, 8)}</option>)}
            </select>
            <input type="number" placeholder="Miqdor" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
            <input placeholder="Izoh" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
            <button onClick={payOut} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">To'lash</button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-bold">Oylik balanslar</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">O'qituvchi</th><th>Oy</th><th>Oylik</th><th>Bonus</th><th>Foiz %</th><th>Tushum</th><th>Foiz daromad</th><th>Jarima</th><th>Jami</th><th>Ko'rinadi</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r: any) => {
                const total = Number(r.salary) + Number(r.bonus) + Number(r.percent_earning ?? 0) - Number(r.penalty);
                return (
                  <tr key={r.id}>
                    <td className="py-2">{nameOf(r.teacher_user_id)}</td>
                    <td>{String(r.period_month).slice(0, 7)}</td>
                    <td>{Number(r.salary).toLocaleString()}</td>
                    <td>{Number(r.bonus).toLocaleString()}</td>
                    <td>{Number(r.percent ?? 0)}%</td>
                    <td>{Number(r.revenue_base ?? 0).toLocaleString()}</td>
                    <td className="font-semibold text-primary">{Number(r.percent_earning ?? 0).toLocaleString()}</td>
                    <td className="text-destructive">{Number(r.penalty).toLocaleString()}</td>
                    <td className="font-bold">{total.toLocaleString()}</td>
                    <td>{r.visible_to_teacher ? "✔" : "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={10} className="py-4 text-center text-muted-foreground">Yozuv yo'q</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-bold">To'lov tarixi</h2>
        <ul className="divide-y divide-border">
          {pays.map((p: any) => (
            <li key={p.id} className="flex items-center justify-between py-2 text-sm">
              <span>{nameOf(p.teacher_user_id)}</span>
              <span className="font-semibold">{Number(p.amount).toLocaleString()} so'm</span>
              <span className="text-xs text-muted-foreground">{new Date(p.paid_at).toLocaleDateString("uz-UZ")}</span>
            </li>
          ))}
          {pays.length === 0 && <li className="py-4 text-center text-muted-foreground">Yozuv yo'q</li>}
        </ul>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, type = "number" }: { label: string; value: number | string; onChange: (v: any) => void; type?: string }) {
  return (
    <label className="block text-sm">
      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
    </label>
  );
}
