import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Lesson = { id: string; group_id: string; end_time: string; group: { name: string } | null };

/** Shows only lessons that ended at least 20 minutes ago but have no attendance. */
export function AttendanceReminder({ userId, teacherOnly }: { userId: string; teacherOnly: boolean }) {
  const [missing, setMissing] = useState<Lesson[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const now = new Date();
      const local = new Date(now.getTime() + 5 * 60 * 60 * 1000);
      const date = local.toISOString().slice(0, 10);
      const jsDay = local.getUTCDay(); const dow = jsDay === 0 ? 7 : jsDay;
      let query = supabase.from("lessons").select("id, group_id, end_time, group:groups(name)").eq("is_active", true).eq("day_of_week", dow);
      if (teacherOnly) query = query.eq("teacher_user_id", userId);
      const { data: lessons } = await query;
      const list = (lessons as unknown as Lesson[] | null) ?? [];
      if (!list.length || !alive) { if (alive) setMissing([]); return; }
      const { data: marked } = await supabase.from("attendance").select("lesson_id").eq("date", date).in("lesson_id", list.map((lesson) => lesson.id));
      const markedIds = new Set((marked ?? []).map((row) => row.lesson_id));
      const cutoff = local.getHours() * 60 + local.getMinutes() - 20;
      if (!alive) return;
      setMissing(list.filter((lesson) => { const [h, m] = lesson.end_time.slice(0, 5).split(":").map(Number); return h * 60 + m <= cutoff && !markedIds.has(lesson.id); }));
    };
    void load();
    const timer = window.setInterval(load, 120_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [teacherOnly, userId]);
  if (!missing.length) return null;
  return <section className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4"><div className="flex flex-wrap items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div className="min-w-0 flex-1"><h2 className="font-bold text-amber-800">Davomat kutilmoqda: {missing.length} ta guruh</h2><p className="mt-1 text-sm text-amber-800/80">{missing.map((lesson) => lesson.group?.name ?? "Guruh").join(", ")}</p></div><Link to="/attendance" className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white"><ClipboardCheck className="h-4 w-4" /> Davomat qilish</Link></div></section>;
}
