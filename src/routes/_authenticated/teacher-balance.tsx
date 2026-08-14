import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Banknote, Save, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teacher-balance")({
  beforeLoad: ({ context }) => {
    const roles = (context as any).roles as string[];
    if (!roles?.some((role) => role === "admin" || role === "director")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: TeacherBalancePage,
});

type Teacher = { id: string; full_name: string | null };
type SalaryPayout = {
  id: string;
  teacher_user_id: string;
  amount: number;
  paid_at: string;
  period_month: string | null;
};

const monthStart = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
};

const nextMonthStart = (periodMonth: string) => {
  const [year, month] = periodMonth.slice(0, 7).split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
};

const keyFor = (teacherId: string, periodMonth: string) =>
  `${teacherId}:${periodMonth.slice(0, 7)}`;
const money = (value: number) => Number(value || 0).toLocaleString("uz-UZ");

function TeacherBalancePage() {
  const { user, roles } = Route.useRouteContext();
  const db = supabase as any;
  const isAdmin = roles.includes("admin");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<SalaryPayout[]>([]);
  const [metrics, setMetrics] = useState({ students: 0, paidStudents: 0, revenue: 0 });
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [busy, setBusy] = useState<"rate" | "salary" | "payout" | null>(null);
  const [form, setForm] = useState({
    teacher_user_id: "",
    period_month: monthStart(),
    percent: 0,
    bonus: 0,
    penalty: 0,
    note: "",
    visible_to_teacher: true,
  });

  const load = async () => {
    const [{ data: roleRows }, { data: balances }, { data: salaryPayouts }] = await Promise.all([
      supabase.from("user_roles").select("user_id").eq("role", "teacher"),
      db.from("teacher_balance").select("*").order("period_month", { ascending: false }).limit(200),
      db
        .from("teacher_salary_payments")
        .select("id, teacher_user_id, amount, paid_at, period_month")
        .order("paid_at", { ascending: false })
        .limit(1000),
    ]);

    const teacherIds = (roleRows ?? []).map((row: any) => row.user_id);
    if (teacherIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", teacherIds);
      setTeachers(
        ((profiles ?? []) as Teacher[]).sort((a, b) =>
          String(a.full_name).localeCompare(String(b.full_name)),
        ),
      );
    } else {
      setTeachers([]);
    }
    setRows(balances ?? []);
    setPayouts((salaryPayouts ?? []) as SalaryPayout[]);
  };

  useEffect(() => {
    void load();
  }, []);

  // The monthly snapshot takes priority. Otherwise the administrator's saved rate is used.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!form.teacher_user_id) return;
      const [{ data: rate }, { data: saved }] = await Promise.all([
        db
          .from("teacher_commission_rates")
          .select("percent")
          .eq("teacher_user_id", form.teacher_user_id)
          .maybeSingle(),
        db
          .from("teacher_balance")
          .select("percent, bonus, penalty, note, visible_to_teacher")
          .eq("teacher_user_id", form.teacher_user_id)
          .eq("period_month", form.period_month)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setForm((current) => {
        if (
          current.teacher_user_id !== form.teacher_user_id ||
          current.period_month !== form.period_month
        )
          return current;
        if (saved) {
          return {
            ...current,
            percent: Number(saved.percent ?? 0),
            bonus: Number(saved.bonus ?? 0),
            penalty: Number(saved.penalty ?? 0),
            note: saved.note ?? "",
            visible_to_teacher: saved.visible_to_teacher ?? true,
          };
        }
        return {
          ...current,
          percent: Number(rate?.percent ?? 0),
          bonus: 0,
          penalty: 0,
          note: "",
          visible_to_teacher: true,
        };
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [form.teacher_user_id, form.period_month]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!form.teacher_user_id) {
        setMetrics({ students: 0, paidStudents: 0, revenue: 0 });
        setMetricsLoading(false);
        return;
      }
      setMetricsLoading(true);
      const end = nextMonthStart(form.period_month);
      const { data: groups } = await supabase
        .from("groups")
        .select("id")
        .eq("teacher_id", form.teacher_user_id);
      const groupIds = (groups ?? []).map((group: any) => group.id);
      const [{ data: directStudents }, { data: enrollments }] = groupIds.length
        ? await Promise.all([
            supabase
              .from("students")
              .select("id")
              .in("group_id", groupIds)
              .in("status_enum", ["active", "trial"]),
            supabase
              .from("student_enrollments")
              .select("student_id")
              .in("group_id", groupIds)
              .in("status", ["active", "trial"]),
          ])
        : [{ data: [] }, { data: [] }];

      // Newer payments keep the teacher as a historical snapshot. The group
      // check is only a fallback for legacy payments that have no snapshot yet.
      const [{ data: snapshotPayments }, { data: legacyPayments }] = await Promise.all([
        db
          .from("payments")
          .select("id, student_id, amount, total_amount")
          .eq("teacher_user_id", form.teacher_user_id)
          .eq("status", "paid")
          .gte("paid_at", `${form.period_month}T00:00:00Z`)
          .lt("paid_at", `${end}T00:00:00Z`),
        groupIds.length
          ? db
              .from("payments")
              .select("id, student_id, amount, total_amount")
              .is("teacher_user_id", null)
              .in("course_id", groupIds)
              .eq("status", "paid")
              .gte("paid_at", `${form.period_month}T00:00:00Z`)
              .lt("paid_at", `${end}T00:00:00Z`)
          : Promise.resolve({ data: [] }),
      ]);
      const payments = Array.from(
        new Map(
          [...(snapshotPayments ?? []), ...(legacyPayments ?? [])].map((payment: any) => [
            payment.id,
            payment,
          ]),
        ).values(),
      );
      if (cancelled) return;
      const activeStudentIds = new Set([
        ...(directStudents ?? []).map((row: any) => row.id),
        ...(enrollments ?? []).map((row: any) => row.student_id),
      ]);
      setMetrics({
        students: activeStudentIds.size,
        paidStudents: new Set((payments ?? []).map((payment: any) => payment.student_id)).size,
        revenue: (payments ?? []).reduce(
          (sum: number, payment: any) => sum + Number(payment.total_amount ?? payment.amount ?? 0),
          0,
        ),
      });
      setMetricsLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setMetrics({ students: 0, paidStudents: 0, revenue: 0 });
        setMetricsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [form.teacher_user_id, form.period_month]);

  const payoutTotals = useMemo(() => {
    const result = new Map<string, number>();
    payouts.forEach((payout) => {
      const period = payout.period_month ?? `${payout.paid_at.slice(0, 7)}-01`;
      const key = keyFor(payout.teacher_user_id, period);
      result.set(key, (result.get(key) ?? 0) + Number(payout.amount || 0));
    });
    return result;
  }, [payouts]);

  const percentEarning = Math.round((metrics.revenue * Number(form.percent || 0)) / 100);
  const total = percentEarning + Number(form.bonus || 0) - Number(form.penalty || 0);
  const selectedPayout = payoutTotals.get(keyFor(form.teacher_user_id, form.period_month)) ?? 0;
  const remaining = Math.max(0, total - selectedPayout);

  const saveRate = async () => {
    if (!isAdmin) return toast.error("Foiz stavkasini faqat administrator belgilaydi");
    if (!form.teacher_user_id) return toast.error("O'qituvchi tanlang");
    setBusy("rate");
    const { error } = await db
      .from("teacher_commission_rates")
      .upsert(
        { teacher_user_id: form.teacher_user_id, percent: form.percent, updated_by: user.id },
        { onConflict: "teacher_user_id" },
      );
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success("Foiz stavkasi keyingi oylar uchun saqlandi");
  };

  const saveMonthly = async () => {
    if (!form.teacher_user_id) return toast.error("O'qituvchi tanlang");
    if (total < 0) return toast.error("Jami oylik manfiy bo'lishi mumkin emas");
    setBusy("salary");
    const { error } = await db.from("teacher_balance").upsert(
      {
        teacher_user_id: form.teacher_user_id,
        period_month: form.period_month,
        salary: 0,
        bonus: form.bonus,
        penalty: form.penalty,
        kpi_score: 0,
        percent: form.percent,
        revenue_base: metrics.revenue,
        percent_earning: percentEarning,
        note: form.note,
        visible_to_teacher: form.visible_to_teacher,
      },
      { onConflict: "teacher_user_id,period_month" },
    );
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Foizli oylik saqlandi");
    await load();
  };

  const recordPayout = async () => {
    if (!form.teacher_user_id) return toast.error("O'qituvchi tanlang");
    const alreadySaved = rows.some(
      (row) =>
        row.teacher_user_id === form.teacher_user_id &&
        String(row.period_month).slice(0, 7) === form.period_month.slice(0, 7),
    );
    if (!alreadySaved) return toast.error("Avval oylikni saqlang");
    if (remaining <= 0) return toast.error("Bu oylik bo'yicha qarzdorlik qolmagan");
    const answer = window.prompt("To'langan summa (so'm)", String(remaining));
    if (answer === null) return;
    const amount = Number(answer.replace(/\s/g, "").replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("To'g'ri summa kiriting");
    if (amount > remaining) return toast.error("Summa qolgan oylikdan katta bo'lmasin");
    setBusy("payout");
    const { error } = await db.from("teacher_salary_payments").insert({
      teacher_user_id: form.teacher_user_id,
      amount,
      period_month: form.period_month,
      paid_at: new Date().toISOString(),
      created_by: user.id,
      note: `Foizli oylik: ${form.period_month.slice(0, 7)}`,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Oylik to'lovi qayd qilindi");
    await load();
  };

  const nameOf = (id: string) =>
    teachers.find((teacher) => teacher.id === id)?.full_name ?? id.slice(0, 8);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold md:text-3xl">
          <Wallet className="h-6 w-6 text-primary" /> O'qituvchi foizli oyligi
        </h1>
        <p className="text-sm text-muted-foreground">
          O'qituvchi oyligi faqat uning guruhlari uchun real qabul qilingan to'lovlardan
          hisoblanadi.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm md:col-span-2">
            O'qituvchi
            <select
              value={form.teacher_user_id}
              onChange={(event) =>
                setForm({
                  ...form,
                  teacher_user_id: event.target.value,
                  percent: 0,
                  bonus: 0,
                  penalty: 0,
                  note: "",
                })
              }
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="">Tanlang</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Oy
            <input
              type="month"
              value={form.period_month.slice(0, 7)}
              onChange={(event) => setForm({ ...form, period_month: `${event.target.value}-01` })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Foiz stavkasi (%)
            <input
              type="number"
              min="0"
              max="100"
              disabled={!isAdmin}
              value={form.percent}
              onChange={(event) => setForm({ ...form, percent: Number(event.target.value) })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
            />
            {!isAdmin && (
              <span className="mt-1 block text-xs text-muted-foreground">
                Foizni administrator belgilaydi.
              </span>
            )}
          </label>
          <label className="text-sm">
            Bonus
            <input
              type="number"
              min="0"
              value={form.bonus}
              onChange={(event) => setForm({ ...form, bonus: Number(event.target.value) })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Jarima
            <input
              type="number"
              min="0"
              value={form.penalty}
              onChange={(event) => setForm({ ...form, penalty: Number(event.target.value) })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm md:col-span-3">
            Izoh
            <textarea
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Faol o'quvchi" value={metricsLoading ? "..." : metrics.students} />
          <Metric label="To'lov qilgan" value={metricsLoading ? "..." : metrics.paidStudents} />
          <Metric label="Real tushum" value={`${money(metrics.revenue)} so'm`} />
          <Metric label="Jami oylik" value={`${money(total)} so'm`} />
          <Metric label="To'langan" value={`${money(selectedPayout)} so'm`} />
          <Metric label="Qolgan oylik" value={`${money(remaining)} so'm`} strong />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {isAdmin && (
            <button
              disabled={busy !== null}
              onClick={() => void saveRate()}
              className="rounded-lg border border-primary/50 px-4 py-2 text-sm font-bold text-primary disabled:opacity-60"
            >
              {busy === "rate" ? "Saqlanmoqda..." : "Foizni doimiy saqlash"}
            </button>
          )}
          <button
            disabled={busy !== null || metricsLoading}
            onClick={() => void saveMonthly()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {busy === "salary" ? "Saqlanmoqda..." : "Oylikni saqlash"}
          </button>
          <button
            disabled={busy !== null || metricsLoading || remaining <= 0}
            onClick={() => void recordPayout()}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 px-4 py-2 text-sm font-bold text-emerald-700 disabled:opacity-60"
          >
            <Banknote className="h-4 w-4" />{" "}
            {busy === "payout" ? "Qayd qilinmoqda..." : "Oylik to'lovini qayd qilish"}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">O'qituvchi</th>
                <th>Oy</th>
                <th>Foiz</th>
                <th>Tushum</th>
                <th>Hisoblangan</th>
                <th>To'langan</th>
                <th>Qolgan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const calculated =
                  Number(row.percent_earning) + Number(row.bonus) - Number(row.penalty);
                const paid =
                  payoutTotals.get(keyFor(row.teacher_user_id, String(row.period_month))) ?? 0;
                return (
                  <tr key={row.id}>
                    <td className="p-3 font-semibold">{nameOf(row.teacher_user_id)}</td>
                    <td>{String(row.period_month).slice(0, 7)}</td>
                    <td>{row.percent}%</td>
                    <td>{money(Number(row.revenue_base))}</td>
                    <td className="text-primary">{money(calculated)}</td>
                    <td className="text-emerald-700">{money(paid)}</td>
                    <td className="font-bold">{money(Math.max(0, calculated - paid))}</td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    Yozuv yo'q
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  strong,
}: {
  label: string;
  value: string | number;
  strong?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={strong ? "mt-1 font-extrabold text-primary" : "mt-1 font-bold"}>{value}</div>
    </div>
  );
}
