import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useState } from "react";
import { TrendingUp, Users, Wallet, ClipboardCheck, AlertTriangle, LayoutGrid, FileSpreadsheet, UserMinus, UserPlus, BookOpen, GraduationCap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, CartesianGrid } from "recharts";
import { toast } from "sonner";
import {
  analyticsSheets, churnRate, netGrowth, pct, rangeFor,
  type DirectorAnalytics, type RangeKey,
} from "@/lib/director-analytics";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [
    { title: "Direktor paneli va hisobotlar | Akhmad Academy" },
    { name: "description", content: "Tushum, qarz, o'quvchilar o'sishi va ketishi, guruhlar to'liqligi hamda fan va o'qituvchi bo'yicha hisobotlar." },
    { property: "og:title", content: "Direktor paneli va hisobotlar | Akhmad Academy" },
    { property: "og:description", content: "Tushum, qarz, o'sish, guruh to'liqligi va Excel hisobotlar." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: ({ context }) => {
    const roles = (context as { roles?: string[] }).roles ?? [];
    if (!roles.includes("director")) throw redirect({ to: "/dashboard" });
  },
  component: ReportsPage,
});

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "this_month", label: "Bu oy" },
  { key: "last_month", label: "O'tgan oy" },
  { key: "quarter", label: "3 oy" },
  { key: "year", label: "Bu yil" },
];

const fmt = (n: number) => `${Math.round(Number(n) || 0).toLocaleString("ru-RU")} so'm`;
const tip = { background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", borderRadius: 8 };
type Tab = "subjects" | "teachers" | "groups";

function ReportsPage() {
  const [range, setRange] = useState(() => rangeFor("this_month"));
  const [active, setActive] = useState<RangeKey | null>("this_month");
  const [data, setData] = useState<DirectorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("groups");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data: res, error: err } = await supabase.rpc("director_analytics", { p_from: range.from, p_to: range.to });
    if (err) setError(err.message); else setData(res as unknown as DirectorAnalytics);
    setLoading(false);
  }, [range.from, range.to]);

  useEffect(() => { void load(); }, [load]);

  const exportXlsx = async () => {
    if (!data) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    for (const [name, rows] of Object.entries(analyticsSheets(data, range.from, range.to))) {
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Ma'lumot": "yo'q" }]);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    }
    XLSX.writeFile(wb, `hisobot-${range.from}_${range.to}.xlsx`);
  };

  const saveCapacity = async (id: string, capacity: number) => {
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 500) { toast.error("Sig'im 1 dan 500 gacha bo'lishi kerak"); return; }
    const { error: err } = await supabase.from("groups").update({ capacity }).eq("id", id);
    if (err) { toast.error(err.message); return; }
    toast.success("Sig'im saqlandi");
    void load();
  };

  const k = data?.kpi;
  const profit = k ? Number(k.income) - Number(k.expense) : 0;
  const growth = k ? netGrowth(k) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Direktor paneli</h1>
          <p className="text-sm text-muted-foreground">Tushum, qarz, o'sish va guruhlar to'liqligi — {range.from} — {range.to}</p>
        </div>
        <button onClick={exportXlsx} disabled={!data} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          <FileSpreadsheet className="h-4 w-4" /> Excel yuklab olish
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => { setActive(r.key); setRange(rangeFor(r.key)); }}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${active === r.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}>
            {r.label}
          </button>
        ))}
        <input type="date" value={range.from} onChange={(e) => { setActive(null); setRange((p) => ({ ...p, from: e.target.value })); }} className="rounded-lg border border-border bg-card px-2 py-1 text-xs" aria-label="Boshlanish sanasi" />
        <span className="text-xs text-muted-foreground">—</span>
        <input type="date" value={range.to} onChange={(e) => { setActive(null); setRange((p) => ({ ...p, to: e.target.value })); }} className="rounded-lg border border-border bg-card px-2 py-1 text-xs" aria-label="Tugash sanasi" />
      </div>

      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Hisobotni yuklab bo'lmadi: {error}</div>}
      {loading && !data && <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>}

      {k && data && (
        <div className={`space-y-5 ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi icon={Wallet} label="Tushum" value={fmt(k.income)} sub={`Xarajat: ${fmt(k.expense)}`} />
            <Kpi icon={TrendingUp} label="Foyda" value={fmt(profit)} tone={profit >= 0 ? "good" : "bad"} />
            <Kpi icon={AlertTriangle} label="Umumiy qarz" value={fmt(k.debt_total)} sub={`${k.debtors} ta qarzdor`} tone={k.debt_total > 0 ? "bad" : undefined} />
            <Kpi icon={ClipboardCheck} label="Davomat" value={`${pct(k.attendance_present, k.attendance_total)}%`} sub={`${k.attendance_present} / ${k.attendance_total} belgi`} />
            <Kpi icon={Users} label="Faol o'quvchilar" value={String(k.active_students)} sub={`Muzlatilgan: ${k.frozen_students}`} />
            <Kpi icon={UserPlus} label="Yangi / sof o'sish" value={`${k.new_students}`} sub={`Sof: ${growth >= 0 ? "+" : ""}${growth}`} tone={growth >= 0 ? "good" : "bad"} />
            <Kpi icon={UserMinus} label="Ketganlar" value={String(k.left_students)} sub={`Ketish: ${churnRate(k)}%`} tone={k.left_students > 0 ? "bad" : undefined} />
            <Kpi icon={LayoutGrid} label="Guruhlar to'liqligi" value={`${pct(k.seats_taken, k.capacity_total)}%`} sub={`${k.seats_taken} / ${k.capacity_total} o'rin, ${k.groups} guruh`} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Tushum va xarajat (12 oy)" icon={Wallet}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly.map((m) => ({ ...m, label: m.month.slice(2) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={tip} />
                    <Legend />
                    <Bar dataKey="income" name="Tushum" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Xarajat" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="O'quvchilar o'sishi va ketishi (12 oy)" icon={Users}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthly.map((m) => ({ ...m, label: m.month.slice(2) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={tip} />
                    <Legend />
                    <Line type="monotone" dataKey="new_students" name="Yangi" stroke="var(--success)" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="left_students" name="Ketgan" stroke="var(--destructive)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap gap-1 border-b border-border p-2">
              {([["groups", "Guruhlar to'liqligi", LayoutGrid], ["subjects", "Fanlar bo'yicha", BookOpen], ["teachers", "O'qituvchilar bo'yicha", GraduationCap]] as const).map(([key, label, Icon]) => (
                <button key={key} onClick={() => setTab(key)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              {tab === "groups" && (
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr><th className="p-3">Guruh</th><th className="p-3">Fan</th><th className="p-3">O'qituvchi</th><th className="p-3">O'quvchilar</th><th className="p-3">Sig'im</th><th className="p-3 w-48">To'liqlik</th></tr>
                  </thead>
                  <tbody>
                    {data.groups.map((g) => {
                      const p = pct(g.students, g.capacity);
                      return (
                        <tr key={g.id} className="border-t border-border">
                          <td className="p-3 font-medium">{g.name}</td>
                          <td className="p-3 text-muted-foreground">{g.subject ?? "—"}</td>
                          <td className="p-3 text-muted-foreground">{g.teacher ?? "—"}</td>
                          <td className="p-3">{g.students}</td>
                          <td className="p-3"><CapacityInput value={g.capacity} onSave={(v) => saveCapacity(g.id, v)} /></td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                <div className={`h-full ${p >= 100 ? "bg-destructive" : p >= 70 ? "bg-success" : "bg-primary"}`} style={{ width: `${Math.min(p, 100)}%` }} />
                              </div>
                              <span className="w-10 text-right text-xs font-semibold">{p}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {tab === "subjects" && (
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr><th className="p-3">Fan</th><th className="p-3">Guruhlar</th><th className="p-3">O'quvchilar</th><th className="p-3">Tushum (davr)</th></tr>
                  </thead>
                  <tbody>
                    {data.subjects.map((s) => (
                      <tr key={s.name} className="border-t border-border">
                        <td className="p-3 font-medium">{s.name}</td><td className="p-3">{s.groups}</td><td className="p-3">{s.students}</td><td className="p-3">{fmt(s.income)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tab === "teachers" && (
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr><th className="p-3">O'qituvchi</th><th className="p-3">Guruhlar</th><th className="p-3">O'quvchilar</th><th className="p-3">Tushum (davr)</th><th className="p-3">Davomat</th></tr>
                  </thead>
                  <tbody>
                    {data.teachers.map((t, i) => (
                      <tr key={`${t.name}-${i}`} className="border-t border-border">
                        <td className="p-3 font-medium">{t.name}</td><td className="p-3">{t.groups}</td><td className="p-3">{t.students}</td><td className="p-3">{fmt(t.income)}</td>
                        <td className="p-3">{t.attendance_total ? `${pct(t.attendance_present, t.attendance_total)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CapacityInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <input type="number" min={1} max={500} value={v} aria-label="Guruh sig'imi"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { const n = Number(v); if (n !== value) onSave(n); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm" />
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: typeof Users; label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className={`mt-2 text-lg font-extrabold md:text-xl ${tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
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
