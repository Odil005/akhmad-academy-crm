import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Check, X, Clock, FileText, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

type Lesson = {
  id: string;
  group_id: string;
  teacher_user_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  group: { name: string } | null;
  subject: { name: string } | null;
  room: { name: string } | null;
};

type Student = { id: string; first_name: string; last_name: string | null };
type Status = "present" | "absent" | "late" | "excused";
type AttRow = { student_id: string; status: Status; note: string | null };

const STATUS_LABEL: Record<Status, string> = {
  present: "Keldi",
  absent: "Kelmadi",
  late: "Kechikdi",
  excused: "Uzrli",
};

const DAYS_FULL = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// JS getDay(): 0=Sun,1=Mon..6=Sat  →  our 1=Mon..7=Sun
function dowFromDate(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

function AttendancePage() {
  const { roles, user } = Route.useRouteContext();
  const isStaff = roles.includes("director") || roles.includes("admin");
  const isTeacher = roles.includes("teacher");
  const canMark = isStaff || isTeacher;

  const [date, setDate] = useState<string>(todayISO());
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonId, setLessonId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, AttRow>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const dow = useMemo(() => dowFromDate(date), [date]);

  // load lessons for the chosen weekday
  useEffect(() => {
    (async () => {
      let q = supabase
        .from("lessons")
        .select("id, group_id, teacher_user_id, day_of_week, start_time, end_time, group:groups(name), subject:subjects(name), room:rooms(name)")
        .eq("day_of_week", dow)
        .eq("is_active", true)
        .order("start_time");
      if (!isStaff && isTeacher) q = q.eq("teacher_user_id", user.id);
      const { data } = await q;
      const list = (data as never as Lesson[]) ?? [];
      setLessons(list);
      setLessonId((prev) => (list.find((l) => l.id === prev) ? prev : (list[0]?.id ?? "")));
    })();
  }, [dow, isStaff, isTeacher, user.id]);

  // load students + existing attendance for lesson+date
  useEffect(() => {
    if (!lessonId) { setStudents([]); setMarks({}); return; }
    (async () => {
      setLoading(true);
      const lesson = lessons.find((l) => l.id === lessonId);
      if (!lesson) { setLoading(false); return; }
      const [{ data: st }, { data: att }] = await Promise.all([
        supabase.from("students").select("id, first_name, last_name").eq("group_id", lesson.group_id).order("first_name"),
        supabase.from("attendance").select("student_id, status, note").eq("lesson_id", lessonId).eq("date", date),
      ]);
      const list = (st as Student[] | null) ?? [];
      setStudents(list);
      const m: Record<string, AttRow> = {};
      for (const s of list) m[s.id] = { student_id: s.id, status: "present", note: null };
      for (const row of (att ?? []) as AttRow[]) m[row.student_id] = row;
      setMarks(m);
      setLoading(false);
    })();
  }, [lessonId, date, lessons]);

  const setStatus = (sid: string, status: Status) => {
    setMarks((m) => ({ ...m, [sid]: { ...(m[sid] ?? { student_id: sid, note: null }), student_id: sid, status } }));
  };
  const setNote = (sid: string, note: string) => {
    setMarks((m) => ({ ...m, [sid]: { ...(m[sid] ?? { student_id: sid, status: "present" }), student_id: sid, note: note || null } }));
  };

  const saveAll = async () => {
    if (!lessonId || students.length === 0) return;
    setSaving(true);
    const rows = students.map((s) => ({
      lesson_id: lessonId,
      student_id: s.id,
      date,
      status: marks[s.id]?.status ?? "present",
      note: marks[s.id]?.note ?? null,
      marked_by: user.id,
    }));
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "lesson_id,student_id,date" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Davomat saqlandi");
  };

  const currentLesson = lessons.find((l) => l.id === lessonId);
  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const s of students) c[marks[s.id]?.status ?? "present"]++;
    return c;
  }, [marks, students]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Davomat</h1>
        <p className="text-sm text-muted-foreground">Kunlik davomatni belgilash</p>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-3">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sana</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <div className="mt-1 text-[10px] text-muted-foreground">{DAYS_FULL[dow - 1]}</div>
        </div>
        <div className="md:col-span-2">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dars</div>
          <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
            {lessons.length === 0 && <option value="">Bu kunda dars yo'q</option>}
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.start_time.slice(0,5)}–{l.end_time.slice(0,5)} · {l.group?.name} · {l.subject?.name ?? "—"}{l.room?.name ? ` · ${l.room.name}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentLesson && (
        <>
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Keldi" value={counts.present} color="text-emerald-500" />
            <Stat label="Kelmadi" value={counts.absent} color="text-destructive" />
            <Stat label="Kechikdi" value={counts.late} color="text-amber-500" />
            <Stat label="Uzrli" value={counts.excused} color="text-sky-500" />
          </div>

          <div className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2 text-sm font-bold">
                <ClipboardCheck className="h-4 w-4 text-primary" /> O'quvchilar ({students.length})
              </div>
              {canMark && students.length > 0 && (
                <button onClick={saveAll} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  {saving ? "..." : "Saqlash"}
                </button>
              )}
            </div>
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">Yuklanmoqda...</p>
            ) : students.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Bu guruhda o'quvchi yo'q</p>
            ) : (
              <ul className="divide-y divide-border">
                {students.map((s) => {
                  const cur = marks[s.id]?.status ?? "present";
                  return (
                    <li key={s.id} className="flex flex-col gap-2 p-3 md:flex-row md:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">{s.first_name} {s.last_name ?? ""}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(["present","absent","late","excused"] as Status[]).map((st) => (
                          <button
                            key={st}
                            disabled={!canMark}
                            onClick={() => setStatus(s.id, st)}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                              cur === st ? statusStyle(st) : "border-border text-muted-foreground hover:border-primary"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            {icon(st)} {STATUS_LABEL[st]}
                          </button>
                        ))}
                        <input
                          disabled={!canMark}
                          value={marks[s.id]?.note ?? ""}
                          onChange={(e) => setNote(s.id, e.target.value)}
                          placeholder="Izoh"
                          className="w-32 rounded-lg border border-border bg-background px-2 py-1.5 text-xs md:w-40"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function icon(s: Status) {
  const cls = "h-3.5 w-3.5";
  if (s === "present") return <Check className={cls} />;
  if (s === "absent") return <X className={cls} />;
  if (s === "late") return <Clock className={cls} />;
  return <FileText className={cls} />;
}

function statusStyle(s: Status): string {
  switch (s) {
    case "present": return "border-emerald-500 bg-emerald-500/10 text-emerald-500";
    case "absent": return "border-destructive bg-destructive/10 text-destructive";
    case "late": return "border-amber-500 bg-amber-500/10 text-amber-500";
    case "excused": return "border-sky-500 bg-sky-500/10 text-sky-500";
  }
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
