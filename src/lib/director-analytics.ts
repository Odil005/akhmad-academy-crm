export type AnalyticsKpi = {
  income: number; expense: number; debt_total: number; debtors: number;
  active_students: number; frozen_students: number; new_students: number; left_students: number;
  attendance_total: number; attendance_present: number;
  groups: number; capacity_total: number; seats_taken: number;
};
export type MonthRow = { month: string; income: number; expense: number; new_students: number; left_students: number };
export type SubjectRow = { name: string; groups: number; students: number; income: number };
export type TeacherRow = { name: string; groups: number; students: number; income: number; attendance_total: number; attendance_present: number };
export type GroupRow = { id: string; name: string; capacity: number; students: number; teacher: string | null; subject: string | null; monthly_fee: number | null };
export type DirectorAnalytics = { kpi: AnalyticsKpi; monthly: MonthRow[]; subjects: SubjectRow[]; teachers: TeacherRow[]; groups: GroupRow[] };

export function pct(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/** O'quvchilar o'sishi: yangi minus ketganlar. */
export function netGrowth(k: Pick<AnalyticsKpi, "new_students" | "left_students">): number {
  return (Number(k.new_students) || 0) - (Number(k.left_students) || 0);
}

/** Ketish darajasi: davr ichida ketganlar / (faol + ketganlar). */
export function churnRate(k: Pick<AnalyticsKpi, "active_students" | "left_students">): number {
  return pct(Number(k.left_students) || 0, (Number(k.active_students) || 0) + (Number(k.left_students) || 0));
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type RangeKey = "this_month" | "last_month" | "quarter" | "year";

/** Brauzer kalendari bo'yicha davr chegaralari (ikkala sana ham kiradi). */
export function rangeFor(key: RangeKey, now = new Date()): { from: string; to: string } {
  const y = now.getFullYear(), m = now.getMonth();
  switch (key) {
    case "this_month": return { from: iso(new Date(y, m, 1)), to: iso(now) };
    case "last_month": return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "quarter": return { from: iso(new Date(y, m - 2, 1)), to: iso(now) };
    case "year": return { from: iso(new Date(y, 0, 1)), to: iso(now) };
  }
}

const so = (n: number) => Math.round(Number(n) || 0);

/** Excel varaqlari uchun qatorlar. */
export function analyticsSheets(a: DirectorAnalytics, from: string, to: string) {
  const k = a.kpi;
  return {
    Umumiy: [
      { "Ko'rsatkich": "Davr", Qiymat: `${from} — ${to}` },
      { "Ko'rsatkich": "Tushum (so'm)", Qiymat: so(k.income) },
      { "Ko'rsatkich": "Xarajat (so'm)", Qiymat: so(k.expense) },
      { "Ko'rsatkich": "Foyda (so'm)", Qiymat: so(k.income) - so(k.expense) },
      { "Ko'rsatkich": "Umumiy qarz (so'm)", Qiymat: so(k.debt_total) },
      { "Ko'rsatkich": "Qarzdorlar soni", Qiymat: k.debtors },
      { "Ko'rsatkich": "Faol o'quvchilar", Qiymat: k.active_students },
      { "Ko'rsatkich": "Muzlatilgan", Qiymat: k.frozen_students },
      { "Ko'rsatkich": "Yangi o'quvchilar", Qiymat: k.new_students },
      { "Ko'rsatkich": "Ketgan o'quvchilar", Qiymat: k.left_students },
      { "Ko'rsatkich": "Sof o'sish", Qiymat: netGrowth(k) },
      { "Ko'rsatkich": "Davomat (%)", Qiymat: pct(k.attendance_present, k.attendance_total) },
      { "Ko'rsatkich": "Guruhlar to'liqligi (%)", Qiymat: pct(k.seats_taken, k.capacity_total) },
    ],
    Oylar: a.monthly.map((r) => ({ Oy: r.month, "Tushum": so(r.income), "Xarajat": so(r.expense), "Foyda": so(r.income) - so(r.expense), "Yangi": r.new_students, "Ketgan": r.left_students })),
    Fanlar: a.subjects.map((r) => ({ Fan: r.name, Guruhlar: r.groups, "O'quvchilar": r.students, "Tushum": so(r.income) })),
    "O'qituvchilar": a.teachers.map((r) => ({ "O'qituvchi": r.name, Guruhlar: r.groups, "O'quvchilar": r.students, "Tushum": so(r.income), "Davomat (%)": pct(r.attendance_present, r.attendance_total) })),
    Guruhlar: a.groups.map((r) => ({ Guruh: r.name, Fan: r.subject ?? "", "O'qituvchi": r.teacher ?? "", "O'quvchilar": r.students, "Sig'im": r.capacity, "To'liqlik (%)": pct(r.students, r.capacity), "Oylik narx": so(r.monthly_fee ?? 0) })),
  };
}
