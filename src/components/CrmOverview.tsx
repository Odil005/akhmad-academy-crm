import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, BookOpen, CalendarDays, CreditCard, FileSpreadsheet, MoreHorizontal, ScanFace, Users, Wallet, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Group = { id: string; name: string; teacher_id: string | null; subject: { name: string } | null; students: number };
type Point = { month: string; income: number; expense: number };
type Activity = { id: string; amount: number; type: string; description: string | null; occurred_at: string };
const fmt = (n: number) => n.toLocaleString("uz-UZ");

export function CrmOverview() {
  const [data, setData] = useState<{ active: number; groups: Group[]; teachers: Record<string, string>; income: number; debtors: number; attendance: number | null; points: Point[]; activity: Activity[] } | null>(null);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [period, setPeriod] = useState<"6" | "3">("6");

  useEffect(() => {
    let alive = true;
    setError(false);
    const load = async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
      const [students, groups, profiles, enrollments, attendance, metrics] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status_enum", "active"),
        supabase.from("groups").select("id,name,teacher_id,subject:subjects(name)").order("name").limit(1000),
        supabase.from("profiles").select("id,full_name").limit(1000),
        supabase.from("student_enrollments").select("group_id").eq("status", "active").limit(1000),
        supabase.from("attendance").select("status").eq("date", today).limit(1000),
        supabase.rpc("admin_desk_metrics"),
      ]);
      if ([students, groups, profiles, enrollments, attendance, metrics].some(r => r.error)) throw new Error("read");
      const tx: Activity[] = [];
      for (let offset = 0; ; offset += 1000) {
        const result = await supabase.from("transactions").select("id,amount,type,description,occurred_at").gte("occurred_at", start.toISOString()).order("occurred_at", { ascending: false }).range(offset, offset + 999);
        if (result.error) throw result.error;
        tx.push(...result.data);
        if (result.data.length < 1000) break;
      }
      const points = Array.from({ length: 6 }, (_, i) => {
        const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
        const rows = tx.filter(t => new Date(t.occurred_at) >= date && new Date(t.occurred_at) < next);
        return { month: date.toLocaleDateString("uz-UZ", { month: "short" }), income: rows.filter(t => t.type === "income").reduce((s,t) => s + Number(t.amount),0), expense: rows.filter(t => t.type === "expense").reduce((s,t) => s + Number(t.amount),0) };
      });
      const counts: Record<string, number> = {};
      for (const e of enrollments.data ?? []) counts[e.group_id] = (counts[e.group_id] ?? 0) + 1;
      if (alive) setData({ active: students.count ?? 0, groups: (groups.data ?? []).map(g => ({ ...g, students: counts[g.id] ?? 0 })), teachers: Object.fromEntries((profiles.data ?? []).map(p => [p.id, p.full_name ?? "—"])), income: tx.filter(t => t.type === "income" && t.occurred_at >= monthStart).reduce((s,t) => s + Number(t.amount),0), debtors: Number(metrics.data?.[0]?.debtors ?? 0), attendance: attendance.data?.length ? Math.round(attendance.data.filter(a => a.status === "present" || a.status === "late").length / attendance.data.length * 100) : null, points, activity: tx.slice(0,5) });
    };
    void load().catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [refresh]);

  if (error) return <div className="flex items-center gap-3 border border-destructive/30 p-4 text-sm"><AlertCircle className="text-destructive" /> Ma’lumotlarni olishda xato <Button variant="outline" size="sm" onClick={() => setRefresh(v => v + 1)}><RefreshCw /> Qayta urinish</Button></div>;

  const cards = [
    { label: "Oylik tushum", value: data ? fmt(data.income) : "…", suffix: "so‘m", icon: Wallet, tone: "text-primary", to: "/finance" },
    { label: "Faol o‘quvchilar", value: data ? fmt(data.active) : "…", suffix: "ta", icon: Users, tone: "text-info", to: "/students" },
    { label: "Guruhlar", value: data ? fmt(data.groups.length) : "…", suffix: "ta", icon: BookOpen, tone: "text-highlight", to: "/groups" },
    { label: "Bugungi davomat", value: data?.attendance == null ? "—" : `${data.attendance}%`, suffix: "", icon: ScanFace, tone: "text-success", to: "/attendance" },
  ];
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((c,i) => <Link key={c.label} to={c.to} className={`crm-panel group min-w-0 p-4 transition-colors hover:border-primary/60 ${i === 0 ? "border-primary/40 bg-primary/5" : ""}`}>
        <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{c.label}</span><c.icon className={`h-4 w-4 shrink-0 ${c.tone}`} /></div>
        <div className="mt-3 break-words text-2xl font-extrabold tabular-nums">{c.value} <span className="text-xs font-medium text-muted-foreground">{c.suffix}</span></div>
        <div className={`mt-3 flex items-center gap-1 text-[11px] ${c.tone}`}><span>{i === 0 ? "Joriy oy" : i === 3 ? "Belgilangan davomat" : "Barcha yozuvlar"}</span><ArrowUpRight className="ml-auto h-3.5 w-3.5" /></div>
      </Link>)}
    </div>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
      <div className="min-w-0 space-y-4">
        <section className="crm-panel p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><h2 className="text-sm font-semibold">Tushum va xarajat dinamikasi</h2><select aria-label="Grafik davri" value={period} onChange={e => setPeriod(e.target.value as "6" | "3")} className="rounded-md border border-border bg-secondary px-2 py-1 text-xs"><option value="6">6 oy</option><option value="3">3 oy</option></select></div>
          <div className="mt-3 flex gap-4 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-primary" /> Tushum</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-highlight" /> Xarajat</span></div>
          <div className="crm-chart mt-4 h-[230px] w-full min-w-0">
            {data ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={period === "3" ? data.points.slice(-3) : data.points} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}><CartesianGrid vertical={false} /><XAxis dataKey="month" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} tickFormatter={v => v >= 1000000 ? `${v / 1000000}m` : v >= 1000 ? `${v / 1000}k` : String(v)} /><Tooltip content={({ active, payload, label }) => active && payload?.length ? <div className="rounded-md border border-border bg-popover p-3 text-xs shadow-lg"><b>{label}</b>{payload.map(p => <div key={p.dataKey} className="mt-1">{p.dataKey === "income" ? "Tushum" : "Xarajat"}: {fmt(Number(p.value))} so‘m</div>)}</div> : null} /><Area type="monotone" dataKey="income" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.1} strokeWidth={2} /><Area type="monotone" dataKey="expense" stroke="var(--highlight)" fill="var(--highlight)" fillOpacity={0.07} strokeWidth={2} /></AreaChart></ResponsiveContainer> : <div className="h-full animate-pulse rounded-md bg-secondary/40" />}
          </div>
        </section>
        <section className="crm-panel overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3"><h2 className="text-sm font-semibold">Guruhlar</h2><Button asChild variant="ghost" size="sm"><Link to="/groups">Barchasi <ArrowUpRight /></Link></Button></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[550px] text-left text-xs"><thead className="border-y border-border bg-secondary/40 text-muted-foreground"><tr>{["Guruh nomi","Fan","O‘qituvchi","O‘quvchilar",""].map(h => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{data?.groups.slice(0,6).map((g,i) => <tr key={g.id} className="hover:bg-secondary/30"><td className="px-4 py-3"><div className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-secondary text-info"><BookOpen className="h-3.5 w-3.5" /></span><span className="font-semibold">{g.name}</span></div></td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 ${i % 3 === 0 ? "bg-warning/15 text-warning" : i % 3 === 1 ? "bg-info/15 text-info" : "bg-highlight/15 text-highlight"}`}>{g.subject?.name ?? "—"}</span></td><td className="px-4 py-3 text-muted-foreground">{g.teacher_id ? data.teachers[g.teacher_id] ?? "—" : "—"}</td><td className="px-4 py-3 tabular-nums">{g.students} ta</td><td className="px-3"><Button asChild variant="ghost" size="icon"><Link to="/groups" title={`${g.name} guruhini ko‘rish`}><ArrowUpRight /></Link></Button></td></tr>)}{data?.groups.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Guruhlar hali qo‘shilmagan</td></tr>}</tbody></table></div>
        </section>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <section className="crm-panel p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Tezkor amallar</h2><MoreHorizontal className="h-4 w-4 text-muted-foreground" /></div><div className="mt-3 space-y-2">{[{to:"/import",label:"Excel ro‘yxatini yuklash",icon:FileSpreadsheet,tone:"text-highlight"},{to:"/face-checkin",label:"USB Face ID",icon:ScanFace,tone:"text-primary"},{to:"/payments",label:"To‘lovlar",icon:CreditCard,tone:"text-info"},{to:"/schedule",label:"Dars jadvali",icon:CalendarDays,tone:"text-warning"}].map(a => <Button key={a.to} asChild variant="outline" className="w-full justify-start bg-secondary/25 text-xs"><Link to={a.to}><a.icon className={a.tone} />{a.label}<ArrowUpRight className="ml-auto text-muted-foreground" /></Link></Button>)}</div></section>
        <section className="crm-panel p-4"><h2 className="text-sm font-semibold">E’tibor talab qiladi</h2><Link to="/debtors" className="mt-3 flex items-center gap-3 border-b border-border pb-3"><span className="grid h-8 w-8 place-items-center rounded-md bg-destructive/10 text-destructive"><CreditCard className="h-4 w-4" /></span><div className="min-w-0"><div className="text-xs font-medium">Qarzdor o‘quvchilar</div><div className="mt-1 text-xs text-destructive">{data?.debtors ?? "…"} ta</div></div><ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground" /></Link><Button asChild variant="ghost" size="sm" className="mt-2 w-full justify-start"><Link to="/attendance"><CalendarDays /> Bugungi davomat</Link></Button></section>
        <section className="crm-panel p-4"><h2 className="text-sm font-semibold">So‘nggi faoliyat</h2><div className="mt-3 divide-y divide-border">{data?.activity.map(a => <div key={a.id} className="flex gap-2 py-3"><span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${a.type === "income" ? "bg-primary/10 text-primary" : "bg-highlight/10 text-highlight"}`}><Wallet className="h-3.5 w-3.5" /></span><div className="min-w-0"><p className="truncate text-xs font-medium">{a.description || (a.type === "income" ? "Kirim" : "Xarajat")}</p><p className="mt-1 text-xs text-muted-foreground">{fmt(Number(a.amount))} so‘m</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(a.occurred_at).toLocaleDateString("uz-UZ")}</p></div></div>)}{data?.activity.length === 0 && <p className="py-5 text-xs text-muted-foreground">Hozircha yozuv yo‘q</p>}</div></section>
      </div>
    </div>
  </div>;
}