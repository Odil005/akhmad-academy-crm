import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, Plus, RefreshCw, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { TelegramIdButton } from "@/components/TelegramIdButton";
import { NewTeacherModal } from "@/components/NewTeacherModal";

export const Route = createFileRoute("/_authenticated/settings/teachers")({ component: TeachersPage });

type Level = "junior" | "middle" | "senior" | "lead";
type DayStatus = "none" | "checked_in" | "attendance_done";
type Row = { user_id: string; full_name: string; phone: string | null; teacher_level: Level | null; username: string | null; groups: number; avatar_url: string | null; day_status: DayStatus };

/** Kunlik holat: qizil = Face ID yo'q, sariq = Face ID bor lekin davomat yo'q, yashil = davomat belgilangan. */
const DAY_STATUS: Record<DayStatus, { label: string; dot: string; text: string }> = {
  none: { label: "Face ID yo'q", dot: "bg-destructive", text: "text-destructive" },
  checked_in: { label: "Face ID bor, davomat yo'q", dot: "bg-amber-500", text: "text-amber-600" },
  attendance_done: { label: "Davomat belgilandi", dot: "bg-emerald-500", text: "text-emerald-600" },
};

const LEVELS: { value: Level; label: string; color: string }[] = [
  { value: "junior", label: "Junior", color: "bg-sky-500/10 text-sky-600" },
  { value: "middle", label: "Middle", color: "bg-emerald-500/10 text-emerald-600" },
  { value: "senior", label: "Senior", color: "bg-amber-500/10 text-amber-600" },
  { value: "lead", label: "Lead", color: "bg-primary/10 text-primary" },
];

function TeachersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [newTeacherOpen, setNewTeacherOpen] = useState(false);

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    try {
      // Mustaqil so'rovlar parallel bajariladi; bu sahifa katta ro'yxatlarda ham tez ochiladi.
      const { data: roles, error: roleError } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
      if (roleError) throw roleError;
      const ids = (roles ?? []).map((r) => r.user_id).filter(Boolean);
      if (!ids.length) { setRows([]); return; }
      const [{ data: profs, error: profileError }, { data: creds }, { data: groups }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, phone, teacher_level, avatar_url").in("id", ids),
        supabase.from("teacher_credentials").select("teacher_user_id, username").in("teacher_user_id", ids),
        supabase.from("groups").select("teacher_id").in("teacher_id", ids),
      ]);
      if (profileError) throw profileError;
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: checkins }, { data: att }] = await Promise.all([
        supabase.from("teacher_checkins").select("user_id").in("user_id", ids).gte("checked_in_at", `${today}T00:00:00`),
        supabase.from("attendance").select("marked_by").in("marked_by", ids).eq("date", today),
      ]);
      const checkedIn = new Set((checkins ?? []).map((c) => c.user_id));
      const marked = new Set((att ?? []).map((a) => a.marked_by).filter(Boolean) as string[]);
      const usernames = new Map((creds ?? []).map((c) => [c.teacher_user_id, c.username]));
      const groupCounts = new Map<string, number>();
      (groups ?? []).forEach((group) => group.teacher_id && groupCounts.set(group.teacher_id, (groupCounts.get(group.teacher_id) ?? 0) + 1));
      setRows((profs ?? []).map((p) => ({
        user_id: p.id,
        full_name: p.full_name || "—",
        phone: p.phone,
        teacher_level: p.teacher_level as Level | null,
        username: usernames.get(p.id) ?? null,
        groups: groupCounts.get(p.id) ?? 0,
        avatar_url: (p as { avatar_url?: string | null }).avatar_url ?? null,
        day_status: marked.has(p.id) ? "attendance_done" : checkedIn.has(p.id) ? "checked_in" : "none",
      })).sort((a, b) => a.full_name.localeCompare(b.full_name, "uz")));
    } catch (error: any) {
      toast.error(error?.message ?? "O'qituvchilar ro'yxatini yuklab bo'lmadi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleRows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return rows;
    return rows.filter((row) => [row.full_name, row.phone, row.username, row.teacher_level].filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(term)));
  }, [query, rows]);

  const setLevel = async (userId: string, level: Level | null) => {
    const previous = rows.find((row) => row.user_id === userId)?.teacher_level ?? null;
    setRows((current) => current.map((row) => row.user_id === userId ? { ...row, teacher_level: level } : row));
    const { error } = await supabase.from("profiles").update({ teacher_level: level }).eq("id", userId);
    if (error) {
      setRows((current) => current.map((row) => row.user_id === userId ? { ...row, teacher_level: previous } : row));
      toast.error(error.message);
      return;
    }
    toast.success("O'qituvchi darajasi yangilandi");
  };

  return <div className="space-y-5">
    <header className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><GraduationCap className="h-6 w-6" /></span>
        <div><h2 className="text-xl font-extrabold">O'qituvchilar ro'yxati</h2><p className="text-sm text-muted-foreground">O'qituvchilar, guruhlari va bog'lanish ma'lumotlarini boshqaring.</p></div>
      </div>
      <button onClick={() => setNewTeacherOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4" /> O'qituvchi qo'shish</button>
    </header>

    <div className="grid gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-semibold text-muted-foreground">Jami o'qituvchi</p><p className="mt-1 text-2xl font-extrabold">{rows.length}</p></div>
      {LEVELS.slice(1).map((level) => <div key={level.value} className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-semibold text-muted-foreground">{level.label}</p><p className="mt-1 text-2xl font-extrabold">{rows.filter((r) => r.teacher_level === level.value).length}</p></div>)}
    </div>

    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ism, telefon yoki login qidiring" className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none ring-primary focus:ring-2" /></div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-muted-foreground">
          {(Object.keys(DAY_STATUS) as DayStatus[]).map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${DAY_STATUS[k].dot}`} />{DAY_STATUS[k].label}</span>)}
        </div>
        <button onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Yangilash</button>
      </div>
      {loading ? <p className="py-12 text-center text-sm text-muted-foreground">Ro'yxat yuklanmoqda...</p> : visibleRows.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground"><Users className="mx-auto mb-3 h-7 w-7 opacity-50" />{query ? "Qidiruvga mos o'qituvchi topilmadi." : "Hali o'qituvchi qo'shilmagan."}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"><tr><th className="pb-3 pr-3">O'qituvchi</th><th className="pb-3 pr-3">Bugungi holat</th><th className="pb-3 pr-3">Telefon</th><th className="pb-3 pr-3">Login</th><th className="pb-3 pr-3 text-center">Guruhlar</th><th className="pb-3 pr-3">Daraja</th><th className="pb-3">Telegram</th></tr></thead><tbody className="divide-y divide-border">{visibleRows.map((row) => <tr key={row.user_id} className="hover:bg-muted/30"><td className="py-3 pr-3 font-semibold"><span className="flex items-center gap-2">{row.avatar_url ? <img src={row.avatar_url} alt={row.full_name} className="h-8 w-8 shrink-0 rounded-full object-cover" width={32} height={32} loading="lazy" decoding="async" /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">{row.full_name.slice(0, 1)}</span>}{row.full_name}</span></td><td className="py-3 pr-3"><span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${DAY_STATUS[row.day_status].text}`}><span className={`h-2.5 w-2.5 rounded-full ${DAY_STATUS[row.day_status].dot}`} />{DAY_STATUS[row.day_status].label}</span></td><td className="py-3 pr-3 text-muted-foreground">{row.phone || "—"}</td><td className="py-3 pr-3 font-mono text-xs text-muted-foreground">{row.username || "—"}</td><td className="py-3 pr-3 text-center font-semibold">{row.groups}</td><td className="py-3 pr-3"><select value={row.teacher_level ?? ""} onChange={(event) => void setLevel(row.user_id, (event.target.value || null) as Level | null)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold"><option value="">Belgilanmagan</option>{LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}</select></td><td className="py-3"><TelegramIdButton kind="teacher" id={row.user_id} name={row.full_name} compact /></td></tr>)}</tbody></table></div>}
    </section>
    {newTeacherOpen && <NewTeacherModal onClose={() => setNewTeacherOpen(false)} onDone={() => void load(true)} />}
  </div>;
}
