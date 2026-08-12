import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X, CalendarDays, Users, GraduationCap, Clock, Activity } from "lucide-react";
import { BirthdayReminders } from "@/components/BirthdayReminders";



type Lesson = {
  id: string;
  group_id: string;
  subject_id: string | null;
  room_id: string | null;
  teacher_user_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  notes: string | null;
  group: { name: string } | null;
  subject: { name: string } | null;
  room: { name: string } | null;
};

type Ref = { id: string; name: string };
type StudentRow = {
  id: string;
  name: string;
  group_id: string | null;
  group_name: string | null;
  lesson_time: string | null;
  schedule_raw: string | null;
  parent_phone: string | null;
  birth_date: string | null;
};
type Teacher = { user_id: string; name: string };

const DAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sha", "Ya"];
const DAYS_FULL = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];

export const Route = createFileRoute("/_authenticated/schedule")({
  component: SchedulePage,
});

function SchedulePage() {
  const { roles, user } = Route.useRouteContext();
  const isStaff = roles.includes("director") || roles.includes("admin");
  const isTeacher = roles.includes("teacher");

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [groups, setGroups] = useState<Ref[]>([]);
  const [subjects, setSubjects] = useState<Ref[]>([]);
  const [rooms, setRooms] = useState<Ref[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentGroupFilter, setStudentGroupFilter] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filterMine, setFilterMine] = useState(isTeacher && !isStaff);
  const [view, setView] = useState<"week" | "day" | "list">("week");
  const [dayView, setDayView] = useState<number>(((new Date().getDay() + 6) % 7) + 1);
  const [teacherFilter, setTeacherFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [teacherQuery, setTeacherQuery] = useState("");
  const [attByLesson, setAttByLesson] = useState<Map<string, { total: number; ok: number }>>(new Map());

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const [{ data: ls }, { data: gs }, { data: ss }, { data: rs }, { data: tr }, { data: tc }, { data: att }] = await Promise.all([
      supabase
        .from("lessons")
        .select("id, group_id, subject_id, room_id, teacher_user_id, day_of_week, start_time, end_time, notes, group:groups(name), subject:subjects(name), room:rooms(name)")
        .eq("is_active", true)
        .order("day_of_week")
        .order("start_time"),
      supabase.from("groups").select("id, name").order("name"),
      supabase.from("subjects").select("id, name").order("name"),
      supabase.from("rooms").select("id, name").eq("is_active", true).order("name"),
      supabase.from("user_roles").select("user_id").eq("role", "teacher"),
      supabase.from("teacher_credentials").select("teacher_user_id, username"),
      supabase.from("attendance").select("lesson_id, status").gte("date", since).limit(5000),
    ]);
    setLessons((ls as never) ?? []);
    setGroups(gs ?? []);
    setSubjects(ss ?? []);
    setRooms(rs ?? []);
    const am = new Map<string, { total: number; ok: number }>();
    for (const a of (att as { lesson_id: string; status: string }[]) ?? []) {
      const cur = am.get(a.lesson_id) ?? { total: 0, ok: 0 };
      cur.total += 1;
      if (a.status === "present" || a.status === "late") cur.ok += 1;
      am.set(a.lesson_id, cur);
    }
    setAttByLesson(am);
    // Union: teachers can come from user_roles (staff view) or from teacher_credentials (fallback)
    const ids = new Set<string>();
    (tr ?? []).forEach((r: any) => r.user_id && ids.add(r.user_id));
    (tc ?? []).forEach((r: any) => r.teacher_user_id && ids.add(r.teacher_user_id));
    const idList = Array.from(ids);
    if (idList.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", idList);
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name ?? ""]));
      const userMap = new Map((tc ?? []).map((t: any) => [t.teacher_user_id, t.username as string]));
      setTeachers(idList.map((id) => ({ user_id: id, name: nameMap.get(id) || userMap.get(id) || "—" })));
    } else {
      setTeachers([]);
    }
    const { data: st } = await supabase
      .from("students")
      .select("id, full_name, first_name, last_name, group_id, lesson_time, schedule_raw, parent_phone, birth_date, group:groups(name)")
      .order("full_name")
      .limit(300);
    setStudents(
      ((st as any[]) ?? []).map((r) => ({
        id: r.id,
        name: r.full_name || `${r.last_name ?? ""} ${r.first_name ?? ""}`.trim() || "—",
        group_id: r.group_id ?? null,
        group_name: r.group?.name ?? null,
        lesson_time: r.lesson_time ?? null,
        schedule_raw: r.schedule_raw ?? null,
        parent_phone: r.parent_phone ?? null,
        birth_date: r.birth_date ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);


  const teacherName = useMemo(() => {
    const m = new Map(teachers.map((t) => [t.user_id, t.name]));
    return (id: string | null) => (id ? (m.get(id) ?? "—") : "Biriktirilmagan");
  }, [teachers]);

  const teacherOptions = useMemo(() => {
    const q = teacherQuery.trim().toLowerCase();
    return q ? teachers.filter((t) => t.name.toLowerCase().includes(q)) : teachers;
  }, [teachers, teacherQuery]);

  const filtered = useMemo(() => {
    const q = teacherQuery.trim().toLowerCase();
    return lessons.filter((l) => {
      if (filterMine && isTeacher && l.teacher_user_id !== user.id) return false;
      if (teacherFilter && l.teacher_user_id !== teacherFilter) return false;
      if (subjectFilter && l.subject_id !== subjectFilter) return false;
      if (groupFilter && l.group_id !== groupFilter) return false;
      if (roomFilter && l.room_id !== roomFilter) return false;
      if (q && !teacherName(l.teacher_user_id).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lessons, filterMine, isTeacher, user.id, teacherFilter, subjectFilter, groupFilter, roomFilter, teacherQuery, teacherName]);

  const byDay = useMemo(() => {
    const m: Record<number, Lesson[]> = {};
    for (let i = 1; i <= 7; i++) m[i] = [];
    for (const l of filtered) m[l.day_of_week]?.push(l);
    return m;
  }, [filtered]);

  const countByGroup = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of students) if (s.group_id) m.set(s.group_id, (m.get(s.group_id) ?? 0) + 1);
    return m;
  }, [students]);

  const visibleStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    return students.filter(
      (s) =>
        (!studentGroupFilter || s.group_id === studentGroupFilter) &&
        (!q || s.name.toLowerCase().includes(q) || (s.parent_phone ?? "").includes(q)),
    );
  }, [students, studentGroupFilter, studentQuery]);

  // Keep this secondary table light so it cannot block route navigation.
  const renderedStudents = useMemo(() => visibleStudents.slice(0, 100), [visibleStudents]);

  const rateOf = (lessonId: string): number | null => {
    const a = attByLesson.get(lessonId);
    if (!a || a.total === 0) return null;
    return Math.round((a.ok / a.total) * 100);
  };

  const teacherStats = useMemo(() => {
    const m = new Map<string, { lessons: number; students: number; total: number; ok: number }>();
    for (const l of filtered) {
      const key = l.teacher_user_id ?? "none";
      const cur = m.get(key) ?? { lessons: 0, students: 0, total: 0, ok: 0 };
      cur.lessons += 1;
      cur.students += countByGroup.get(l.group_id) ?? 0;
      const a = attByLesson.get(l.id);
      if (a) { cur.total += a.total; cur.ok += a.ok; }
      m.set(key, cur);
    }
    return Array.from(m.entries())
      .map(([id, v]) => ({
        id,
        name: id === "none" ? "Biriktirilmagan" : teacherName(id),
        ...v,
        rate: v.total ? Math.round((v.ok / v.total) * 100) : null,
      }))
      .sort((a, b) => b.lessons - a.lessons);
  }, [filtered, countByGroup, attByLesson, teacherName]);

  const overallRate = useMemo(() => {
    let total = 0, ok = 0;
    for (const l of filtered) {
      const a = attByLesson.get(l.id);
      if (a) { total += a.total; ok += a.ok; }
    }
    return total ? Math.round((ok / total) * 100) : null;
  }, [filtered, attByLesson]);


  const remove = async (id: string) => {
    if (!confirm("Dars o'chirilsinmi?")) return;
    await supabase.from("lessons").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Dars jadvali</h1>
          <p className="text-sm text-muted-foreground">Haftalik takrorlanadigan darslar</p>
        </div>
        <div className="flex items-center gap-2">
          {isTeacher && (
            <button
              onClick={() => setFilterMine((v: boolean) => !v)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${filterMine ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
            >
              {filterMine ? "Faqat mening darslarim" : "Hammasi"}
            </button>
          )}
          {isStaff && (
            <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
              <Plus className="h-4 w-4" /> Dars qo'shish
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <div className="flex rounded-lg border border-border p-0.5">
          {([["week", "Haftalik"], ["day", "Kunlik"], ["list", "Ro'yxat"]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {view === "day" && (
          <select value={dayView} onChange={(e) => setDayView(Number(e.target.value))} className="rounded-lg border border-border bg-background px-3 py-2 text-xs">
            {DAYS_FULL.map((d, i) => <option key={i} value={i + 1}>{d}</option>)}
          </select>
        )}
        <input
          value={teacherQuery}
          onChange={(e) => setTeacherQuery(e.target.value)}
          placeholder="O'qituvchi ism-familiyasi..."
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
        />
        <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-xs">
          <option value="">Barcha o'qituvchilar</option>
          {teacherOptions.map((t) => <option key={t.user_id} value={t.user_id}>{t.name}</option>)}
        </select>
        <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-xs">
          <option value="">Barcha fanlar</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-xs">
          <option value="">Barcha guruhlar</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-xs">
          <option value="">Barcha xonalar</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <span className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span>{filtered.length} dars</span>
          {overallRate !== null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 font-semibold">
              <Activity className="h-3 w-3 text-primary" /> Davomat {overallRate}%
            </span>
          )}
        </span>
      </div>

      {/* O'qituvchilar */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold">O'qituvchilar</h2>
          <span className="text-xs text-muted-foreground">{teacherStats.length}</span>
        </div>
        {teacherStats.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ma'lumot yo'q</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {teacherStats.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTeacherFilter(t.id === "none" ? "" : (teacherFilter === t.id ? "" : t.id))}
                className={`rounded-xl border p-3 text-left transition-colors ${teacherFilter === t.id ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/50"}`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {t.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {t.lessons} dars · {t.students} o'quvchi
                    </div>
                  </div>
                </div>
                <AttBar rate={t.rate} />
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
      ) : view === "list" ? (
        <div className="overflow-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr>
                {["Kun", "Vaqt", "O'qituvchi", "Fan", "Guruh", "Xona", "Davomat", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-xs text-muted-foreground">Dars topilmadi</td></tr>
              ) : filtered.map((l) => (
                <tr key={l.id} className="border-t border-border transition-colors hover:bg-muted/40">
                  <td className="px-3 py-1.5">{DAYS_FULL[l.day_of_week - 1]}</td>
                  <td className="px-3 py-1.5 font-mono text-xs text-primary">{l.start_time.slice(0,5)}–{l.end_time.slice(0,5)}</td>
                  <td className="px-3 py-1.5 font-medium">{teacherName(l.teacher_user_id)}</td>
                  <td className="px-3 py-1.5">{l.subject?.name ?? "—"}</td>
                  <td className="px-3 py-1.5">{l.group?.name ?? "—"}</td>
                  <td className="px-3 py-1.5">{l.room?.name ?? "—"}</td>
                  <td className="px-3 py-1.5"><div className="w-28"><AttBar rate={rateOf(l.id)} /></div></td>
                  <td className="px-3 py-1.5 text-right">
                    {isStaff && (
                      <button onClick={() => remove(l.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === "week" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <WeekGrid
            byDay={byDay}
            teacherName={teacherName}
            rateOf={rateOf}
            isStaff={isStaff}
            onRemove={remove}
            subjects={subjects}
          />
          <SchedulePanel
            byDay={byDay}
            teacherName={teacherName}
            groups={groups}
            countByGroup={countByGroup}
            subjects={subjects}
            lessons={filtered}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {[DAYS_FULL[dayView - 1]!].map((label) => {
            const d = dayView;
            const items = byDay[d] ?? [];
            const isToday = d === ((new Date().getDay() + 6) % 7) + 1;
            return (
              <div
                key={d}
                className={`rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md ${isToday ? "border-primary/60 ring-1 ring-primary/20" : "border-border"}`}
              >
                <div className="mb-3 flex items-center gap-2">
                  <CalendarDays className={`h-4 w-4 ${isToday ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-sm font-bold">{label}</div>
                  {isToday && <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">bugun</span>}
                  <div className="ml-auto text-[10px] text-muted-foreground">{items.length}</div>
                </div>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                      Bo'sh
                    </div>
                  ) : items.map((l) => (
                    <div
                      key={l.id}
                      className="group relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-background to-muted/40 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                    >
                      <span className="absolute inset-y-0 left-0 w-1 bg-primary/70" />
                      <div className="flex items-start justify-between pl-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="inline-flex items-center gap-1 font-mono text-xs text-primary">
                            <Clock className="h-3 w-3" /> {l.start_time.slice(0,5)}–{l.end_time.slice(0,5)}
                          </div>
                          <div className="mt-1 truncate text-sm font-semibold">{l.group?.name ?? "—"}</div>
                          <div className="inline-flex items-center gap-1 truncate text-xs font-medium">
                            <GraduationCap className="h-3 w-3 text-muted-foreground" /> {teacherName(l.teacher_user_id)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {l.subject?.name ?? "—"}{l.room?.name ? ` · ${l.room.name}` : ""}
                          </div>
                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary">
                            <Users className="h-3 w-3" /> {countByGroup.get(l.group_id) ?? 0} o'quvchi
                          </div>
                          <AttBar rate={rateOf(l.id)} />
                        </div>
                        {isStaff && (
                          <button onClick={() => remove(l.id)} className="ml-2 text-destructive opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-70">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}



      <BirthdayReminders days={3} />

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold">O'quvchilar ro'yxati</h2>
          <span className="text-xs text-muted-foreground">{visibleStudents.length}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="Ism yoki telefon..."
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
            />
            <select
              value={studentGroupFilter}
              onChange={(e) => setStudentGroupFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
            >
              <option value="">Barcha guruhlar</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
        <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-xs uppercase">
              <tr>
                {["#", "O'quvchi", "Guruh", "Dars vaqti", "Ota-ona tel", "Tug'ilgan sana"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleStudents.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">O'quvchi topilmadi</td></tr>
              ) : renderedStudents.map((s, i) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-1.5 font-medium">
                    <Link to="/students/$id" params={{ id: s.id }} className="hover:text-primary">{s.name}</Link>
                  </td>
                  <td className="px-3 py-1.5">{s.group_name ?? "—"}</td>
                  <td className="px-3 py-1.5">{s.lesson_time ?? s.schedule_raw ?? "—"}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{s.parent_phone ?? "—"}</td>
                  <td className="px-3 py-1.5">{s.birth_date ? new Date(s.birth_date).toLocaleDateString("uz-UZ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleStudents.length > renderedStudents.length && (
          <div className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">
            Birinchi {renderedStudents.length} ta ko‘rsatildi. To‘liq ro‘yxat O‘quvchilar bo‘limida.
          </div>
        )}
      </div>

      {open && (
        <NewLessonModal
          groups={groups}
          subjects={subjects}
          rooms={rooms}
          teachers={teachers}
          existing={lessons}
          onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

function NewLessonModal({
  groups, subjects, rooms, teachers, existing, onClose, onDone,
}: {
  groups: Ref[]; subjects: Ref[]; rooms: Ref[]; teachers: Teacher[];
  existing: Lesson[];
  onClose: () => void; onDone: () => void;
}) {
  const [localGroups, setLocalGroups] = useState<Ref[]>(groups);
  const [form, setForm] = useState({
    group_id: groups[0]?.id ?? "",
    subject_id: subjects[0]?.id ?? "",
    room_id: rooms[0]?.id ?? "",
    teacher_user_id: teachers[0]?.user_id ?? "",
    day_of_week: 1,
    start_time: "18:00",
    end_time: "19:30",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(groups.length === 0);
  const [newGroup, setNewGroup] = useState({ name: "", monthly_fee: 400000 });
  const [creatingGroup, setCreatingGroup] = useState(false);

  const createGroup = async () => {
    if (!newGroup.name.trim()) { setError("Guruh nomini kiriting"); return; }
    setCreatingGroup(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("groups")
      .insert({
        name: newGroup.name.trim(),
        subject_id: form.subject_id || null,
        monthly_fee: newGroup.monthly_fee,
      })
      .select("id, name")
      .single();
    setCreatingGroup(false);
    if (err || !data) { setError(err?.message ?? "Guruh yaratilmadi"); return; }
    setLocalGroups((prev) => [...prev, data as Ref].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((f) => ({ ...f, group_id: data.id }));
    setNewGroup({ name: "", monthly_fee: 400000 });
    setShowNewGroup(false);
  };

  const conflicts = useMemo(() => {
    const st = form.start_time + ":00";
    const en = form.end_time + ":00";
    const dayLessons = existing.filter((l) => l.day_of_week === form.day_of_week);
    const roomC = form.room_id
      ? dayLessons.find((l) => l.room_id === form.room_id && overlaps(st, en, l.start_time, l.end_time))
      : null;
    const teacherC = form.teacher_user_id
      ? dayLessons.find((l) => l.teacher_user_id === form.teacher_user_id && overlaps(st, en, l.start_time, l.end_time))
      : null;
    const groupC = form.group_id
      ? dayLessons.find((l) => l.group_id === form.group_id && overlaps(st, en, l.start_time, l.end_time))
      : null;
    return { roomC, teacherC, groupC };
  }, [form, existing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.group_id) { setError("Avval guruhni tanlang yoki yarating"); return; }
    if (form.start_time >= form.end_time) { setError("Tugash vaqti boshlanishdan keyin bo'lishi kerak"); return; }
    if (conflicts.roomC) { setError("Bu vaqtda xona band"); return; }
    if (conflicts.teacherC) { setError("Bu vaqtda o'qituvchi band"); return; }
    if (conflicts.groupC) { setError("Bu vaqtda guruhda boshqa dars bor"); return; }
    setLoading(true);
    const { error } = await supabase.from("lessons").insert({
      group_id: form.group_id,
      subject_id: form.subject_id || null,
      room_id: form.room_id || null,
      teacher_user_id: form.teacher_user_id || null,
      day_of_week: form.day_of_week,
      start_time: form.start_time,
      end_time: form.end_time,
      notes: form.notes || null,
    });
    if (error) { setError(error.message); setLoading(false); return; }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Yangi dars</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Row label="Guruh">
            {localGroups.length === 0 && !showNewGroup ? (
              <div className="rounded-lg border border-dashed border-border bg-background p-3 text-xs text-muted-foreground">
                Hozircha guruh yo'q.{" "}
                <button type="button" onClick={() => setShowNewGroup(true)} className="font-semibold text-primary underline">
                  Yangi guruh yaratish
                </button>{" "}
                yoki{" "}
                <Link to="/groups" className="font-semibold text-primary underline">Guruhlar bo'limi</Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select required value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5">
                  <option value="">— tanlang —</option>
                  {localGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewGroup((v) => !v)}
                  className="shrink-0 rounded-lg border border-border px-2.5 py-2.5 text-xs font-semibold hover:bg-muted"
                  title="Yangi guruh"
                >
                  {showNewGroup ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </button>
              </div>
            )}
            {showNewGroup && (
              <div className="mt-2 space-y-2 rounded-lg border border-border bg-background p-3">
                <input
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  placeholder="Guruh nomi (masalan: Ingliz-A1-Ertalab)"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={newGroup.monthly_fee}
                    onChange={(e) => setNewGroup({ ...newGroup, monthly_fee: Number(e.target.value) })}
                    placeholder="Oylik to'lov"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={creatingGroup}
                    onClick={createGroup}
                    className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {creatingGroup ? "..." : "Saqlash"}
                  </button>
                </div>
              </div>
            )}
          </Row>

          <Row label="Fan">
            <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5">
              <option value="">—</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Row>
          <Row label="Xona">
            <select value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5">
              <option value="">—</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Row>
          <Row label="O'qituvchi">
            <select value={form.teacher_user_id} onChange={(e) => setForm({ ...form, teacher_user_id: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5">
              <option value="">—</option>
              {teachers.map((t) => <option key={t.user_id} value={t.user_id}>{t.name}</option>)}
            </select>
          </Row>
          <Row label="Hafta kuni">
            <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5">
              {DAYS_FULL.map((d, i) => <option key={i} value={i + 1}>{d}</option>)}
            </select>
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Boshlanish">
              <input required type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
            </Row>
            <Row label="Tugash">
              <input required type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
            </Row>
          </div>
          {(conflicts.roomC || conflicts.teacherC || conflicts.groupC) && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              ⚠ Konflikt: {conflicts.roomC && "xona band. "}{conflicts.teacherC && "o'qituvchi band. "}{conflicts.groupC && "guruh band."}
            </div>
          )}
          {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {loading ? "..." : "Saqlash"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

// Silence unused warning
void DAYS;

function AttBar({ rate }: { rate: number | null }) {
  if (rate === null) {
    return <div className="mt-2 text-[10px] text-muted-foreground">Davomat ma'lumoti yo'q</div>;
  }
  const tone =
    rate >= 85 ? "bg-emerald-500" : rate >= 65 ? "bg-amber-500" : "bg-red-500";
  const text =
    rate >= 85 ? "text-emerald-600" : rate >= 65 ? "text-amber-600" : "text-red-600";
  return (
    <div className="mt-2">
      <div className="mb-0.5 flex items-center justify-between text-[10px] font-semibold">
        <span className="text-muted-foreground">Davomat (30 kun)</span>
        <span className={text}>{rate}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

/* ---------------- Weekly time-grid calendar ---------------- */

const GRID_DAYS = [1, 2, 3, 4, 5, 6];
const HOUR_H = 62;

function toMin(t: string) {
  const [h, m] = t.slice(0, 5).split(":");
  return Number(h) * 60 + Number(m);
}

function subjectTone(subjects: Ref[], subjectId: string | null) {
  const i = subjectId ? Math.max(0, subjects.findIndex((s) => s.id === subjectId)) : 0;
  return `var(--chart-${(i % 5) + 1})`;
}

function weekDates() {
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  return GRID_DAYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const MONTHS_UZ = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];

function WeekGrid({
  byDay, teacherName, rateOf, isStaff, onRemove, subjects,
}: {
  byDay: Record<number, Lesson[]>;
  teacherName: (id: string | null) => string;
  rateOf: (id: string) => number | null;
  isStaff: boolean;
  onRemove: (id: string) => void;
  subjects: Ref[];
}) {
  const all = GRID_DAYS.flatMap((d) => byDay[d] ?? []);
  const startHour = all.length ? Math.max(6, Math.min(...all.map((l) => Math.floor(toMin(l.start_time) / 60)))) : 8;
  const endHour = all.length ? Math.min(23, Math.max(...all.map((l) => Math.ceil(toMin(l.end_time) / 60))) + 1) : 21;
  const hours = Array.from({ length: Math.max(1, endHour - startHour) }, (_, i) => startHour + i);
  const dates = weekDates();
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-[64px_repeat(6,minmax(0,1fr))] border-b border-border">
        <div />
        {GRID_DAYS.map((d, i) => (
          <div
            key={d}
            className={`border-l border-border px-2 py-3 text-center ${i === todayIdx ? "bg-primary/5" : ""}`}
          >
            <div className="text-xs font-bold sm:text-sm">{DAYS_FULL[d - 1]}</div>
            <div className={`text-[11px] font-semibold ${i === todayIdx ? "text-primary" : "text-muted-foreground"}`}>
              {dates[i]!.getDate()} {MONTHS_UZ[dates[i]!.getMonth()]}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div className="relative grid min-w-[720px] grid-cols-[64px_repeat(6,minmax(0,1fr))]">
          {/* time axis */}
          <div className="relative">
            {hours.map((h) => (
              <div key={h} className="relative" style={{ height: HOUR_H }}>
                <span className="absolute -top-2 right-2 text-[11px] font-medium text-muted-foreground">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {GRID_DAYS.map((d, i) => {
            const items = (byDay[d] ?? []).slice().sort((a, b) => a.start_time.localeCompare(b.start_time));
            return (
              <div
                key={d}
                className={`relative border-l border-border ${i === todayIdx ? "bg-primary/[0.03]" : ""}`}
                style={{ height: hours.length * HOUR_H }}
              >
                {hours.map((h) => (
                  <div key={h} className="border-b border-border/50" style={{ height: HOUR_H }} />
                ))}
                {items.map((l) => {
                  const top = ((toMin(l.start_time) - startHour * 60) / 60) * HOUR_H;
                  const height = Math.max(46, ((toMin(l.end_time) - toMin(l.start_time)) / 60) * HOUR_H - 4);
                  const tone = subjectTone(subjects, l.subject_id);
                  const rate = rateOf(l.id);
                  return (
                    <div
                      key={l.id}
                      className="group absolute left-1 right-1 overflow-hidden rounded-lg border p-2 text-[11px] shadow-sm transition hover:z-10 hover:shadow-md"
                      style={{
                        top,
                        height,
                        borderColor: `color-mix(in oklab, ${tone} 45%, transparent)`,
                        background: `color-mix(in oklab, ${tone} 10%, var(--card))`,
                      }}
                    >
                      <div className="flex items-start gap-1">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-bold" style={{ color: tone }}>
                            {l.subject?.name ?? "Fan"}{l.group?.name ? ` — ${l.group.name}` : ""}
                          </div>
                          <div className="truncate text-muted-foreground">{teacherName(l.teacher_user_id)}</div>
                          {l.room?.name && (
                            <div className="truncate text-muted-foreground">◎ {l.room.name}</div>
                          )}
                          <div className="truncate font-mono text-muted-foreground">
                            {l.start_time.slice(0, 5)} – {l.end_time.slice(0, 5)}
                          </div>
                          {rate !== null && (
                            <div className="mt-1 flex items-center gap-1">
                              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                <span
                                  className={`block h-full rounded-full ${rate >= 85 ? "bg-emerald-500" : rate >= 65 ? "bg-amber-500" : "bg-red-500"}`}
                                  style={{ width: `${rate}%` }}
                                />
                              </span>
                              <span className="font-semibold text-muted-foreground">{rate}%</span>
                            </div>
                          )}
                          {rate === null && (
                            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                              Davomat kutilmoqda
                            </div>
                          )}
                        </div>
                        {isStaff && (
                          <button
                            onClick={() => onRemove(l.id)}
                            className="text-destructive opacity-0 transition-opacity group-hover:opacity-70"
                            title="O'chirish"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SchedulePanel({
  byDay, teacherName, groups, countByGroup, subjects, lessons,
}: {
  byDay: Record<number, Lesson[]>;
  teacherName: (id: string | null) => string;
  groups: Ref[];
  countByGroup: Map<string, number>;
  subjects: Ref[];
  lessons: Lesson[];
}) {
  const today = ((new Date().getDay() + 6) % 7) + 1;
  const items = (byDay[today] ?? []).slice().sort((a, b) => a.start_time.localeCompare(b.start_time));
  const now = new Date();

  const bySubject = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of lessons) {
      const key = l.subject_id ?? "none";
      if (!m.has(key)) m.set(key, new Set());
      m.get(key)!.add(l.group_id);
    }
    return Array.from(m.entries())
      .map(([id, set]) => ({
        id,
        name: subjects.find((s) => s.id === id)?.name ?? "Fan tanlanmagan",
        tone: subjectTone(subjects, id === "none" ? null : id),
        count: set.size,
      }))
      .sort((a, b) => b.count - a.count);
  }, [lessons, subjects]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-start justify-between gap-2 border-b border-border p-4">
          <div>
            <div className="text-sm font-bold">Bugungi darslar</div>
            <div className="text-xs text-muted-foreground">
              {now.getDate()} {MONTHS_UZ[now.getMonth()]}, {DAYS_FULL[today - 1]!.toLowerCase()}
            </div>
          </div>
          <CalendarDays className="h-4 w-4 text-primary" />
        </div>
        <ul className="divide-y divide-border">
          {items.length === 0 ? (
            <li className="p-4 text-xs text-muted-foreground">Bugun dars yo'q</li>
          ) : items.map((l) => (
            <li key={l.id} className="flex items-start gap-2 p-4">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ background: subjectTone(subjects, l.subject_id) }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {l.subject?.name ?? "Fan"}{l.group?.name ? ` — ${l.group.name}` : ""}
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {l.start_time.slice(0, 5)} – {l.end_time.slice(0, 5)}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">{teacherName(l.teacher_user_id)}</span>
                  {l.room?.name && (
                    <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium">
                      {l.room.name}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="text-sm font-bold">Guruhlar jami</div>
          <div className="text-2xl font-extrabold text-primary">{groups.length}</div>
        </div>
        <ul className="divide-y divide-border">
          {bySubject.length === 0 ? (
            <li className="p-4 text-xs text-muted-foreground">Ma'lumot yo'q</li>
          ) : bySubject.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-4 py-2.5">
              <span
                className="h-6 w-6 shrink-0 rounded-md"
                style={{ background: `color-mix(in oklab, ${s.tone} 25%, transparent)`, border: `1px solid color-mix(in oklab, ${s.tone} 50%, transparent)` }}
              />
              <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
              <span className="text-sm font-bold">{s.count}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-border p-3">
          <Link
            to="/groups"
            className="flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary"
          >
            Batafsil ko'rish →
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 text-sm font-bold">O'quvchilar (guruh bo'yicha)</div>
        <ul className="max-h-56 space-y-1 overflow-auto text-xs">
          {groups.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted/50">
              <span className="truncate">{g.name}</span>
              <span className="font-semibold text-primary">{countByGroup.get(g.id) ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
