import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Users, Wallet, ClipboardCheck, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  beforeLoad: ({ context }) => {
    const roles = (context as { roles?: string[] }).roles ?? [];
    if (!roles.includes("director")) throw redirect({ to: "/dashboard" });
  },
  component: ReportsPage,
});

type MonthlyRow = { month: string; amount: number };
type StatusRow = { name: string; value: number };
type TeacherRow = { teacher: string; lessons: number; salary: number };

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastNMonths(n: number): string[] {
  const arr: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const c = new Date(d.getFullYear(), d.getMonth() - i, 1);
    arr.push(monthKey(c));
  }
  return arr;
}

const COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7"];

function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [revenueByMonth, setRevenueByMonth] = useState<MonthlyRow[]>([]);
  const [studentsByStatus, setStudentsByStatus] = useState<StatusRow[]>([]);
  const [attendanceRate, setAttendanceRate] = useState<number>(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [prevMonthRevenue, setPrevMonthRevenue] = useState(0);
  const [totalSalary, setTotalSalary] = useState(0);
  const [teacherKpi, setTeacherKpi] = useState<TeacherRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const months = lastNMonths(6);
      const startISO = months[0] + "-01";

      // Payments in last 6 months
      const { data: pays } = await supabase
        .from("payments")
        .select("amount, status, paid_at, period_month")
        .eq("status", "paid")
        .gte("paid_at", startISO);

      const bucket: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]));
      for (const p of (pays ?? []) as { amount: number; paid_at: string | null }[]) {
        if (!p.paid_at) continue;
        const k = monthKey(new Date(p.paid_at));
        if (k in bucket) bucket[k] += Number(p.amount) || 0;
      }
      setRevenueByMonth(months.map((m) => ({ month: m.slice(2), amount: bucket[m] })));
      const now = monthKey(new Date());
      const prev = months[months.length - 2];
      setMonthRevenue(bucket[now] ?? 0);
      setPrevMonthRevenue(bucket[prev] ?? 0);

      // Students grouped by status
      const { data: st } = await supabase.from("students").select("status_enum");
      const map: Record<string, number> = {};
      for (const s of (st ?? []) as { status_enum: string | null }[]) {
        const k = s.status_enum ?? "unknown";
        map[k] = (map[k] ?? 0) + 1;
      }
      setStudentsByStatus(Object.entries(map).map(([name, value]) => ({ name, value })));
      setTotalStudents((st ?? []).length);

      // Attendance rate this month
      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      const { data: att } = await supabase
        .from("attendance")
        .select("status")
        .gte("date", firstOfMonth.toISOString().slice(0, 10));
      const total = (att ?? []).length;
      const present = (att ?? []).filter((a) => a.status === "present" || a.status === "late").length;
      setAttendanceRate(total ? Math.round((present / total) * 100) : 0);

      // Teacher salaries this month
      const { data: sal } = await supabase
        .from("teacher_salary_payments")
        .select("amount, teacher_user_id, paid_at")
        .gte("paid_at", firstOfMonth.toISOString());
      const salByTeacher: Record<string, number> = {};
      let totSal = 0;
      for (const s of (sal ?? []) as { amount: number; teacher_user_id: string }[]) {
        const a = Number(s.amount) || 0;
        totSal += a;
        salByTeacher[s.teacher_user_id] = (salByTeacher[s.teacher_user_id] ?? 0) + a;
      }
      setTotalSalary(totSal);

      // Teacher KPI: lessons count this month + salary
      const { data: lessons } = await supabase
        .from("lessons")
        .select("teacher_user_id")
        .eq("is_active", true);
      const lessonByTeacher: Record<string, number> = {};
      for (const l of (lessons ?? []) as { teacher_user_id: string | null }[]) {
        if (!l.teacher_user_id) continue;
        lessonByTeacher[l.teacher_user_id] = (lessonByTeacher[l.teacher_user_id] ?? 0) + 1;
      }
      const teacherIds = Array.from(new Set([...Object.keys(lessonByTeacher), ...Object.keys(salByTeacher)]));
      let names: Record<string, string> = {};
      if (teacherIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", teacherIds);
        names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name || "—"]));
      }
      setTeacherKpi(
        teacherIds
          .map((id) => ({
            teacher: names[id] || id.slice(0, 6),
            lessons: lessonByTeacher[id] ?? 0,
            salary: salByTeacher[id] ?? 0,
          }))
          .sort((a, b) => b.lessons - a.lessons)
          .slice(0, 10)
      );

      setLoading(false);
    })();
  }, []);

  const growth = useMemo(() => {
    if (!prevMonthRevenue) return null;
    return Math.round(((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100);
  }, [monthRevenue, prevMonthRevenue]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Hisobotlar</h1>
        <p className="text-sm text-muted-foreground">Director uchun asosiy KPI va moliya ko'rsatkichlari</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi icon={Wallet} label="Bu oy daromad" value={`${monthRevenue.toLocaleString()} so'm`} accent={growth != null ? (growth >= 0 ? "text-emerald-500" : "text-destructive") : undefined} sub={growth != null ? `${growth >= 0 ? "+" : ""}${growth}% o'tgan oyga` : undefined} />
            <Kpi icon={Users} label="O'quvchilar" value={totalStudents.toString()} />
            <Kpi icon={ClipboardCheck} label="Davomat" value={`${attendanceRate}%`} />
            <Kpi icon={Trophy} label="Oylik maosh" value={`${totalSalary.toLocaleString()} so'm`} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Daromad tendentsiyasi (6 oy)" icon={TrendingUp}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueByMonth}>
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v: number) => `${v.toLocaleString()} so'm`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="O'quvchilar holati bo'yicha" icon={Users}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={studentsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {studentsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="O'qituvchi KPI (top 10)" icon={Trophy}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teacherKpi}>
                    <XAxis dataKey="teacher" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="lessons" fill="hsl(var(--primary))" name="Darslar" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Oylik maosh (top 10)" icon={Wallet}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teacherKpi}>
                    <XAxis dataKey="teacher" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v: number) => `${v.toLocaleString()} so'm`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="salary" fill="#22c55e" name="Maosh" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, accent }: { icon: typeof Users; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 text-xl font-extrabold">{value}</div>
      {sub && <div className={`text-xs ${accent ?? "text-muted-foreground"}`}>{sub}</div>}
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Users; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <div className="text-sm font-bold">{title}</div>
      </div>
      {children}
    </div>
  );
}
