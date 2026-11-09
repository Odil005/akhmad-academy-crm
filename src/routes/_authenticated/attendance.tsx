import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Check, X, Clock, FileText, ClipboardCheck, Eraser, Save } from "lucide-react";
import { toast } from "sonner";
import { tashkentDate } from '@/features/face/attendance';

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
  head: () => ({ meta: [
    { title: 'Davomat | Akhmad CRM' },
    { name: "description", content: 'Akhmad CRM — davomat va o‘quv markazini boshqarish.' },
    { property: "og:title", content: 'Davomat | Akhmad CRM' },
    { property: "og:description", content: 'Akhmad CRM — davomat va o‘quv markazini boshqarish.' },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AttendancePage,
});

function todayISO(): string {
  return tashkentDate(new Date());
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
  const [savedCount, setSavedCount] = useState(0);

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
      if (!isStaff && isTeacher) {
        // O'qituvchi o'zi biriktirilgan dars yoki o'zi olib boradigan guruh darslarini ko'radi.
        const { data: own } = await supabase.from("groups").select("id").eq("teacher_id", user.id);
        const ids = (own ?? []).map((g) => g.id);
        q = ids.length
          ? q.or(`teacher_user_id.eq.${user.id},group_id.in.(${ids.join(",")})`)
          : q.eq("teacher_user_id", user.id);
      }
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
      const [{ data: enrollments }, { data: att }] = await Promise.all([
        supabase.from("student_enrollments").select("students(id, first_name, last_name)").eq("group_id", lesson.group_id).eq('status', 'active').lte('started_at', date).or(`ended_at.is.null,ended_at.gte.${date}`),
        supabase.from("attendance").select("student_id, status, note").eq("lesson_id", lessonId).eq("date", date),
      ]);
      const list = (enrollments ?? []).flatMap(row => row.students ? [{ id: row.students.id, first_name: row.students.first_name ?? '', last_name: row.students.last_name }] : []).sort((a, b) => a.first_name.localeCompare(b.first_name));
      setStudents(list);
      const m: Record<string, AttRow> = {};
      for (const s of list) m[s.id] = { student_id: s.id, status: "absent", note: null };
      for (const row of (att ?? []) as AttRow[]) m[row.student_id] = row;
      setMarks(m);
      setSavedCount((att ?? []).length);
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
    else { setSavedCount(rows.length); toast.success("Davomat saqlandi"); }
  };

  const togglePresent = (sid: string) => {
    const cur = marks[sid]?.status ?? "absent";
    setStatus(sid, cur === "present" || cur === "late" ? "absent" : "present");
  };
  const markAll = (status: Status) => {
    setMarks((m) => {
      const next = { ...m };
      for (const s of students) next[s.id] = { ...(next[s.id] ?? { note: null }), student_id: s.id, status };
      return next;
    });
  };

  const currentLesson = lessons.find((l) => l.id === lessonId);
  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const s of students) c[marks[s.id]?.status ?? "absent"]++;
    return c;
  }, [marks, students]);

  const extras = (s: Student, cur: Status) => (
    <>
      {(["late","excused"] as Status[]).map((st) => (
        <button
          key={st}
          disabled={!canMark}
          onClick={() => setStatus(s.id, cur === st ? (st === "late" ? "present" : "absent") : st)}
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
        className="w-32 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-base md:w-40 md:flex-none md:text-xs"
      />
    </>
  );

  return (
    <div className={`space-y-5 ${currentLesson && canMark && students.length > 0 ? "pb-20 lg:pb-0" : ""}`}>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Davomat</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentLesson
            ? `${currentLesson.group?.name ?? "Guruh"} · ${date === todayISO() ? "Bugun" : DAYS_FULL[dow - 1]} ${currentLesson.start_time.slice(0,5)}–${currentLesson.end_time.slice(0,5)}`
            : "Darsni tanlang, kelgan o'quvchilarni ptichka bilan belgilang va saqlang"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-3">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sana</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base md:text-sm" />
          <div className="mt-1 text-[10px] text-muted-foreground">{DAYS_FULL[dow - 1]}</div>
        </div>
        <div className="md:col-span-2">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dars</div>
          <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base md:text-sm">
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
            <Stat label="Keldi" value={counts.present} color="text-success" />
            <Stat label="Kechikdi" value={counts.late} color="text-warning" />
            <Stat label="Kelmadi" value={counts.absent} color="text-destructive" />
            <Stat label="Uzrli" value={counts.excused} color="text-info" />
          </div>

          {canMark && students.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:hidden">
              <button onClick={() => markAll("present")} className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground"><Check className="h-5 w-5" strokeWidth={3} /> Hammasi keldi</button>
              <button onClick={() => markAll("absent")} className="flex items-center justify-center gap-2 rounded-xl border border-border py-3.5 text-sm font-bold"><Eraser className="h-5 w-5" /> Tozalash</button>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2 text-sm font-bold">
                <ClipboardCheck className="h-4 w-4 text-primary" /> O'quvchilar ({students.length})
              </div>
              <span className="text-xs text-muted-foreground md:hidden">{savedCount > 0 ? "Saqlangan" : "Hali saqlanmagan"}</span>
              {canMark && students.length > 0 && (
                <div className="hidden flex-wrap items-center gap-2 md:flex">
                  <span className="text-xs text-muted-foreground">{savedCount > 0 ? "Saqlangan" : "Hali saqlanmagan"}</span>
                  <button onClick={() => markAll("present")} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary">Hammasi keldi</button>
                  <button onClick={() => markAll("absent")} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary">Tozalash</button>
                  <button onClick={saveAll} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                    {saving ? "..." : "Saqlash"}
                  </button>
                </div>
              )}
            </div>
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">Yuklanmoqda...</p>
            ) : students.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Bu guruhda o'quvchi yo'q</p>
            ) : (
              <ul className="divide-y divide-border">
                {students.map((s) => {
                  const cur = marks[s.id]?.status ?? "absent";
                  const ticked = cur === "present" || cur === "late";
                  const initials = `${s.first_name[0] ?? ""}${s.last_name?.[0] ?? ""}`.toUpperCase();
                  return (
                    <li key={s.id} className="p-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-sm font-bold">{initials || "?"}</span>
                        <div className="min-w-0 flex-1">
                          <Link to="/students/$id" params={{ id: s.id }} className="block truncate text-sm font-semibold hover:text-primary hover:underline">{s.first_name} {s.last_name ?? ""}</Link>
                          <div className={`text-xs ${statusText(cur)}`}>{STATUS_LABEL[cur]}</div>
                        </div>
                        <div className="hidden items-center gap-1.5 md:flex">{extras(s, cur)}</div>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={ticked}
                          aria-label={`${s.first_name} ${s.last_name ?? ""} keldi`}
                          disabled={!canMark}
                          onClick={() => togglePresent(s.id)}
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            cur === "late"
                              ? "border-warning bg-warning text-primary-foreground"
                              : ticked
                                ? "border-success bg-success text-primary-foreground"
                                : "border-border text-muted-foreground hover:border-primary"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {cur === "late" ? <Clock className="h-5 w-5" strokeWidth={3} /> : ticked ? <Check className="h-6 w-6" strokeWidth={3} /> : null}
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-14 md:hidden">{extras(s, cur)}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {canMark && students.length > 0 && (
            <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 px-4 pb-2 md:hidden">
              <button onClick={saveAll} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-extrabold text-primary-foreground shadow-lg disabled:opacity-60">
                <Save className="h-5 w-5" /> {saving ? "Saqlanmoqda…" : "Saqlash"}
              </button>
            </div>
          )}
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
    case "present": return "border-success bg-success/10 text-success";
    case "absent": return "border-destructive bg-destructive/10 text-destructive";
    case "late": return "border-warning bg-warning/10 text-warning";
    case "excused": return "border-info bg-info/10 text-info";
  }
}

function statusText(s: Status): string {
  switch (s) {
    case "present": return "text-success";
    case "absent": return "text-destructive";
    case "late": return "text-warning";
    case "excused": return "text-info";
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
