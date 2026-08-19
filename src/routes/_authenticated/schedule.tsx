import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { emitDataChanged, useDataEvent } from "@/lib/data-events";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  findLessonConflicts,
  normalizedTime,
  scheduleConflictMessage,
} from "@/features/schedule/domain";
import { createLesson } from "@/features/schedule/mutations";
import { GroupSummaryPanel } from "@/features/schedule/GroupSummaryPanel";
import {
  DAYS_FULL,
  addDays,
  dateKey,
  formatWeekRange,
  startOfWeek,
  tashkentNow,
  toMinutes,
} from "@/features/schedule/layout";
import { TodayLessonsPanel } from "@/features/schedule/TodayLessonsPanel";
import { WeekTimeGrid } from "@/features/schedule/WeekTimeGrid";
import type {
  ScheduleGroup,
  ScheduleLesson,
  ScheduleRef,
  ScheduleTeacher,
} from "@/features/schedule/types";
import { isStaff as hasStaffRole } from "@/lib/authz";

type Lesson = ScheduleLesson;
type Ref = ScheduleRef;
type GroupRef = ScheduleGroup;
type TeacherRoleRow = { user_id: string | null };
type TeacherCredentialRow = { teacher_user_id: string | null; username: string };
type Teacher = ScheduleTeacher;

export const Route = createFileRoute("/_authenticated/schedule")({
  component: SchedulePage,
});

function SchedulePage() {
  const { roles, user } = Route.useRouteContext();
  const isStaff = hasStaffRole(roles);
  const isTeacher = roles.includes("teacher");

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [groups, setGroups] = useState<GroupRef[]>([]);
  const [subjects, setSubjects] = useState<Ref[]>([]);
  const [rooms, setRooms] = useState<Ref[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [studentCountByGroup, setStudentCountByGroup] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filterMine, setFilterMine] = useState(isTeacher && !isStaff);
  const [view, setView] = useState<"week" | "day" | "list">("week");
  const [dayView, setDayView] = useState<number>(((tashkentNow().getDay() + 6) % 7) + 1);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(tashkentNow()));
  const [weekAttendance, setWeekAttendance] = useState<Set<string>>(new Set());
  const [teacherFilter, setTeacherFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [teacherQuery, setTeacherQuery] = useState("");
  const [attByLesson, setAttByLesson] = useState<Map<string, { total: number; ok: number }>>(
    new Map(),
  );

  // The database returns one compact summary row per lesson. This keeps the
  // timetable responsive as attendance and enrollment data grows.
  const loadInsights = useCallback(async () => {
    if (!isStaff && !isTeacher) return;
    const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const { data: insights, error } = await supabase.rpc("schedule_insights", { p_since: since });
    if (error) throw error;

    const attendanceByLesson = new Map<string, { total: number; ok: number }>();
    const enrolledByGroup = new Map<string, number>();
    for (const row of insights ?? []) {
      attendanceByLesson.set(row.lesson_id, {
        total: Number(row.attendance_total ?? 0),
        ok: Number(row.attendance_ok ?? 0),
      });
      enrolledByGroup.set(row.group_id, Number(row.enrolled_students ?? 0));
    }
    setAttByLesson(attendanceByLesson);
    setStudentCountByGroup(enrolledByGroup);
  }, [isStaff, isTeacher]);

  const load = useCallback(async () => {
    setLoading(true);
    let lessonQuery = supabase
      .from("lessons")
      .select(
        "id, group_id, subject_id, room_id, teacher_user_id, day_of_week, start_time, end_time, notes, group:groups(name), subject:subjects(name), room:rooms(name)",
      )
      .eq("is_active", true)
      .order("day_of_week")
      .order("start_time");
    let groupQuery = supabase
      .from("groups")
      .select("id, name, teacher_id, subject_id")
      .order("name");
    if (isTeacher && !isStaff) {
      lessonQuery = lessonQuery.eq("teacher_user_id", user.id);
      groupQuery = groupQuery.eq("teacher_id", user.id);
    }
    const [{ data: ls }, { data: gs }, { data: ss }, { data: rs }, { data: tr }, { data: tc }] =
      await Promise.all([
        lessonQuery,
        groupQuery,
        supabase.from("subjects").select("id, name").order("name"),
        supabase.from("rooms").select("id, name").eq("is_active", true).order("name"),
        supabase.from("user_roles").select("user_id").eq("role", "teacher"),
        supabase.from("teacher_credentials").select("teacher_user_id, username"),
      ]);
    setLessons((ls ?? []) as unknown as Lesson[]);
    setGroups((gs ?? []) as unknown as GroupRef[]);
    setSubjects(ss ?? []);
    setRooms(rs ?? []);
    // Render the timetable immediately. Resolving teacher display names is a
    // secondary request and must not block the visible schedule.
    setLoading(false);
    // Union: teachers can come from user_roles (staff view) or from teacher_credentials (fallback)
    const ids = new Set<string>();
    for (const row of (tr ?? []) as TeacherRoleRow[]) {
      if (row.user_id) ids.add(row.user_id);
    }
    for (const row of (tc ?? []) as TeacherCredentialRow[]) {
      if (row.teacher_user_id) ids.add(row.teacher_user_id);
    }
    const idList = Array.from(ids);
    if (idList.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", idList);
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name ?? ""]));
      const userMap = new Map(
        ((tc ?? []) as TeacherCredentialRow[])
          .filter((teacher) => teacher.teacher_user_id)
          .map((teacher) => [teacher.teacher_user_id!, teacher.username]),
      );
      setTeachers(
        idList.map((id) => ({ user_id: id, name: nameMap.get(id) || userMap.get(id) || "—" })),
      );
    } else {
      setTeachers([]);
    }
    void loadInsights().catch(() => undefined);
  }, [isStaff, isTeacher, loadInsights, user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useDataEvent("groups", load);

  useEffect(() => {
    let cancelled = false;
    const loadWeekAttendance = async () => {
      const lessonIds = lessons.map((lesson) => lesson.id);
      if (lessonIds.length === 0) {
        if (!cancelled) setWeekAttendance(new Set());
        return;
      }

      const weekStartKey = dateKey(weekStart);
      const rpcResult = await supabase.rpc("schedule_week_attendance", {
        p_week_start: weekStartKey,
      });
      if (!rpcResult.error) {
        const keys = new Set(
          (rpcResult.data ?? [])
            .filter((row) => Number(row.attendance_count ?? 0) > 0)
            .map((row) => `${row.lesson_id}:${row.attendance_date}`),
        );
        if (!cancelled) setWeekAttendance(keys);
        return;
      }

      // Old deployments keep working before the compact RPC migration is applied.
      const { data } = await supabase
        .from("attendance")
        .select("lesson_id, date")
        .in("lesson_id", lessonIds)
        .gte("date", weekStartKey)
        .lte("date", dateKey(addDays(weekStart, 6)));
      if (!cancelled) {
        setWeekAttendance(new Set((data ?? []).map((row) => `${row.lesson_id}:${row.date}`)));
      }
    };

    void loadWeekAttendance();
    return () => {
      cancelled = true;
    };
  }, [lessons, weekStart]);

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
  }, [
    lessons,
    filterMine,
    isTeacher,
    user.id,
    teacherFilter,
    subjectFilter,
    groupFilter,
    roomFilter,
    teacherQuery,
    teacherName,
  ]);

  const byDay = useMemo(() => {
    const m: Record<number, Lesson[]> = {};
    for (let i = 1; i <= 7; i++) m[i] = [];
    for (const l of filtered) m[l.day_of_week]?.push(l);
    return m;
  }, [filtered]);

  const countByGroup = studentCountByGroup;
  const now = tashkentNow();
  const todayKey = dateKey(now);
  const todayDay = ((now.getDay() + 6) % 7) + 1;
  const currentWeekKey = dateKey(startOfWeek(now));
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const weekDays = useMemo(() => {
    const days = [1, 2, 3, 4, 5, 6];
    if ((byDay[7]?.length ?? 0) > 0) days.push(7);
    return days;
  }, [byDay]);
  const displayDays = view === "day" ? [dayView] : weekDays;
  const todayLessons = useMemo(
    () => lessons.filter((lesson) => lesson.day_of_week === todayDay),
    [lessons, todayDay],
  );

  const isAttendancePending = (lesson: Lesson, occurrence: Date) => {
    if (dateKey(weekStart) !== currentWeekKey) return false;
    if ((countByGroup.get(lesson.group_id) ?? 0) === 0) return false;
    const occurrenceKey = dateKey(occurrence);
    if (occurrenceKey > todayKey) return false;
    if (occurrenceKey === todayKey && currentMinute < toMinutes(lesson.end_time) + 20) return false;
    return !weekAttendance.has(`${lesson.id}:${occurrenceKey}`);
  };

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
      if (a) {
        cur.total += a.total;
        cur.ok += a.ok;
      }
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
    let total = 0,
      ok = 0;
    for (const l of filtered) {
      const a = attByLesson.get(l.id);
      if (a) {
        total += a.total;
        ok += a.ok;
      }
    }
    return total ? Math.round((ok / total) * 100) : null;
  }, [filtered, attByLesson]);

  const remove = async (id: string) => {
    if (!confirm("Dars o'chirilsinmi?")) return;
    await supabase.from("lessons").delete().eq("id", id);
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Dars jadvali</h1>
          <p className="text-sm text-muted-foreground">Haftalik takrorlanadigan darslar</p>
        </div>
        <div className="flex items-center justify-self-start overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:justify-self-center">
          <button
            type="button"
            onClick={() => setWeekStart((date) => addDays(date, -7))}
            className="border-r border-border p-2.5 transition hover:bg-muted"
            aria-label="Oldingi hafta"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="inline-flex min-w-[190px] items-center justify-center gap-2 px-3 text-sm font-bold">
            {formatWeekRange(weekStart, weekDays.includes(7) ? 6 : 5)}
            <CalendarDays className="h-4 w-4 text-primary" />
          </div>
          <button
            type="button"
            onClick={() => setWeekStart((date) => addDays(date, 7))}
            className="border-l border-border p-2.5 transition hover:bg-muted"
            aria-label="Keyingi hafta"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 lg:justify-self-end">
          <button
            type="button"
            onClick={() => {
              setWeekStart(startOfWeek(tashkentNow()));
              setDayView(((tashkentNow().getDay() + 6) % 7) + 1);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-bold transition hover:bg-muted"
          >
            <CalendarDays className="h-4 w-4" /> Bugun
          </button>
          {isStaff && (
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:brightness-105"
            >
              <Plus className="h-4 w-4" /> Yangi dars
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2.5 shadow-sm">
        <div className="flex rounded-lg border border-border p-0.5">
          {(
            [
              ["week", "Haftalik"],
              ["day", "Kunlik"],
              ["list", "Ro'yxat"],
            ] as const
          ).map(([v, label]) => (
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
          <select
            value={dayView}
            onChange={(e) => setDayView(Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
          >
            {DAYS_FULL.map((d, i) => (
              <option key={i} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
        )}
        {isTeacher && isStaff && (
          <button
            type="button"
            onClick={() => setFilterMine((value) => !value)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              filterMine
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {filterMine ? "Faqat mening darslarim" : "Barcha darslar"}
          </button>
        )}
        <details className="group/filters open:basis-full">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filtrlar
          </summary>
          <div className="mt-2 grid w-full gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-2 xl:grid-cols-5">
            <input
              value={teacherQuery}
              onChange={(e) => setTeacherQuery(e.target.value)}
              placeholder="O'qituvchi ism-familiyasi..."
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
            />
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
            >
              <option value="">Barcha o'qituvchilar</option>
              {teacherOptions.map((t) => (
                <option key={t.user_id} value={t.user_id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
            >
              <option value="">Barcha fanlar</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
            >
              <option value="">Barcha guruhlar</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
            >
              <option value="">Barcha xonalar</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </details>
        <span className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span>{filtered.length} dars</span>
          {overallRate !== null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 font-semibold">
              <Activity className="h-3 w-3 text-primary" /> Davomat {overallRate}%
            </span>
          )}
        </span>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {loading ? (
            <div className="grid min-h-[620px] place-items-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">
              Jadval yuklanmoqda...
            </div>
          ) : view === "list" ? (
            <div className="overflow-auto rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs uppercase">
                  <tr>
                    {["Kun", "Vaqt", "O'qituvchi", "Fan", "Guruh", "Xona", "Davomat", ""].map(
                      (heading) => (
                        <th key={heading} className="px-3 py-2 text-left font-semibold">
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-8 text-center text-xs text-muted-foreground"
                      >
                        Dars topilmadi
                      </td>
                    </tr>
                  ) : (
                    filtered.map((lesson) => (
                      <tr key={lesson.id} className="border-t border-border hover:bg-muted/40">
                        <td className="px-3 py-2">{DAYS_FULL[lesson.day_of_week - 1]}</td>
                        <td className="px-3 py-2 font-mono text-xs text-primary">
                          {lesson.start_time.slice(0, 5)}–{lesson.end_time.slice(0, 5)}
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {teacherName(lesson.teacher_user_id)}
                        </td>
                        <td className="px-3 py-2">{lesson.subject?.name ?? "—"}</td>
                        <td className="px-3 py-2">{lesson.group?.name ?? "—"}</td>
                        <td className="px-3 py-2">{lesson.room?.name ?? "—"}</td>
                        <td className="px-3 py-2">
                          <div className="w-28">
                            <AttBar rate={rateOf(lesson.id)} />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {isStaff && (
                            <button
                              type="button"
                              onClick={() => remove(lesson.id)}
                              className="text-destructive hover:opacity-70"
                              aria-label="Darsni o'chirish"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <WeekTimeGrid
              days={displayDays}
              byDay={byDay}
              weekStart={weekStart}
              teacherName={teacherName}
              isStaff={isStaff}
              isAttendancePending={isAttendancePending}
              onRemove={remove}
              onSelectDay={(day) => {
                setDayView(day);
                setView("day");
              }}
            />
          )}
        </div>

        <aside className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <TodayLessonsPanel
            lessons={todayLessons}
            today={now}
            teacherName={teacherName}
            onShowAll={() => setView("list")}
          />
          <GroupSummaryPanel groups={groups} subjects={subjects} lessons={lessons} />
        </aside>
      </div>

      <details className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold">
          <GraduationCap className="h-4 w-4 text-primary" />
          <span>O'qituvchilar va yuklama</span>
          <span className="text-xs text-muted-foreground">{teacherStats.length}</span>
          <span className="ml-auto text-xs font-medium text-muted-foreground">ko'rsatish</span>
        </summary>
        <div className="mt-3">
          {teacherStats.length === 0 ? (
            <p className="text-xs text-muted-foreground">Ma'lumot yo'q</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {teacherStats.map((teacher) => (
                <button
                  key={teacher.id}
                  type="button"
                  onClick={() =>
                    setTeacherFilter(
                      teacher.id === "none" ? "" : teacherFilter === teacher.id ? "" : teacher.id,
                    )
                  }
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    teacherFilter === teacher.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {teacher.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{teacher.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {teacher.lessons} dars · {teacher.students} o'quvchi
                      </div>
                    </div>
                  </div>
                  <AttBar rate={teacher.rate} />
                </button>
              ))}
            </div>
          )}
        </div>
      </details>

      {open && (
        <NewLessonModal
          groups={groups}
          subjects={subjects}
          rooms={rooms}
          teachers={teachers}
          existing={lessons}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function NewLessonModal({
  groups,
  subjects,
  rooms,
  teachers,
  existing,
  onClose,
  onDone,
}: {
  groups: GroupRef[];
  subjects: Ref[];
  rooms: Ref[];
  teachers: Teacher[];
  existing: Lesson[];
  onClose: () => void;
  onDone: () => void;
}) {
  const create = useServerFn(createLesson);
  const [localGroups, setLocalGroups] = useState<GroupRef[]>(groups);
  const [form, setForm] = useState({
    group_id: groups[0]?.id ?? "",
    subject_id: subjects[0]?.id ?? "",
    room_id: rooms[0]?.id ?? "",
    teacher_user_id: groups[0]?.teacher_id ?? teachers[0]?.user_id ?? "",
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
    if (!newGroup.name.trim()) {
      setError("Guruh nomini kiriting");
      return;
    }
    setCreatingGroup(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("groups")
      .insert({
        name: newGroup.name.trim(),
        subject_id: form.subject_id || null,
        teacher_id: form.teacher_user_id || null,
        monthly_fee: newGroup.monthly_fee,
      })
      .select("id, name, teacher_id, subject_id")
      .single();
    setCreatingGroup(false);
    if (err || !data) {
      setError(err?.message ?? "Guruh yaratilmadi");
      return;
    }
    setLocalGroups((prev) =>
      [...prev, data as GroupRef].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setForm((f) => ({ ...f, group_id: data.id }));
    setNewGroup({ name: "", monthly_fee: 400000 });
    setShowNewGroup(false);
    emitDataChanged("groups");
  };

  const conflictRows = useMemo(
    () =>
      findLessonConflicts(
        {
          group_id: form.group_id,
          room_id: form.room_id || null,
          teacher_user_id: form.teacher_user_id || null,
          day_of_week: form.day_of_week,
          start_time: normalizedTime(form.start_time),
          end_time: normalizedTime(form.end_time),
        },
        existing,
      ),
    [form, existing],
  );
  const conflicts = {
    roomC: conflictRows.some((conflict) => conflict.kind === "room"),
    teacherC: conflictRows.some((conflict) => conflict.kind === "teacher"),
    groupC: conflictRows.some((conflict) => conflict.kind === "group"),
  };
  const conflictDetails = useMemo(
    () =>
      conflictRows.map((conflict) => {
        const lesson = existing.find((item) => item.id === conflict.lessonId);
        const resource =
          conflict.kind === "room"
            ? "Xona band"
            : conflict.kind === "teacher"
              ? "O'qituvchi band"
              : "Guruh band";
        const lessonLabel = lesson?.group?.name ?? "Boshqa dars";
        const time = lesson
          ? `${lesson.start_time.slice(0, 5)}–${lesson.end_time.slice(0, 5)}`
          : "";
        return { ...conflict, label: `${resource}: ${lessonLabel}${time ? ` (${time})` : ""}` };
      }),
    [conflictRows, existing],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.group_id) {
      setError("Avval guruhni tanlang yoki yarating");
      return;
    }
    if (form.start_time >= form.end_time) {
      setError("Tugash vaqti boshlanishdan keyin bo'lishi kerak");
      return;
    }
    if (conflicts.roomC) {
      setError("Bu vaqtda xona band");
      return;
    }
    if (conflicts.teacherC) {
      setError("Bu vaqtda o'qituvchi band");
      return;
    }
    if (conflicts.groupC) {
      setError("Bu vaqtda guruhda boshqa dars bor");
      return;
    }
    setLoading(true);
    try {
      const result = await create({
        data: {
          group_id: form.group_id,
          subject_id: form.subject_id || null,
          room_id: form.room_id || null,
          teacher_user_id: form.teacher_user_id || null,
          day_of_week: form.day_of_week,
          start_time: form.start_time,
          end_time: form.end_time,
          notes: form.notes || null,
        },
      });
      if (!result.ok) {
        setError(scheduleConflictMessage(result));
        setLoading(false);
        return;
      }
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dars jadvalini saqlab bo'lmadi.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Yangi dars</h2>
          <button onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Row label="Guruh">
            {localGroups.length === 0 && !showNewGroup ? (
              <div className="rounded-lg border border-dashed border-border bg-background p-3 text-xs text-muted-foreground">
                Hozircha guruh yo'q.{" "}
                <button
                  type="button"
                  onClick={() => setShowNewGroup(true)}
                  className="font-semibold text-primary underline"
                >
                  Yangi guruh yaratish
                </button>{" "}
                yoki{" "}
                <Link to="/groups" className="font-semibold text-primary underline">
                  Guruhlar bo'limi
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  required
                  value={form.group_id}
                  onChange={(e) => {
                    const group = localGroups.find((item) => item.id === e.target.value);
                    setForm({
                      ...form,
                      group_id: e.target.value,
                      teacher_user_id: group?.teacher_id ?? form.teacher_user_id,
                    });
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
                >
                  <option value="">— tanlang —</option>
                  {localGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
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
                    onChange={(e) =>
                      setNewGroup({ ...newGroup, monthly_fee: Number(e.target.value) })
                    }
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
            <select
              value={form.subject_id}
              onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
            >
              <option value="">—</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Xona">
            <select
              value={form.room_id}
              onChange={(e) => setForm({ ...form, room_id: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
            >
              <option value="">—</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Row>
          <Row label="O'qituvchi">
            <select
              value={form.teacher_user_id}
              onChange={(e) => setForm({ ...form, teacher_user_id: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
            >
              <option value="">—</option>
              {teachers.map((t) => (
                <option key={t.user_id} value={t.user_id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Hafta kuni">
            <select
              value={form.day_of_week}
              onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
            >
              {DAYS_FULL.map((d, i) => (
                <option key={i} value={i + 1}>
                  {d}
                </option>
              ))}
            </select>
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Boshlanish">
              <input
                required
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
              />
            </Row>
            <Row label="Tugash">
              <input
                required
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
              />
            </Row>
          </div>
          {conflictDetails.length > 0 && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <div className="font-semibold">⚠ Jadval konflikti</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {conflictDetails.map((conflict) => (
                  <li key={`${conflict.kind}-${conflict.lessonId}`}>{conflict.label}</li>
                ))}
              </ul>
            </div>
          )}
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </p>
          )}
          <button
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
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
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </label>
  );
}

function AttBar({ rate }: { rate: number | null }) {
  if (rate === null) {
    return <div className="mt-2 text-[10px] text-muted-foreground">Davomat ma'lumoti yo'q</div>;
  }
  const tone = rate >= 85 ? "bg-emerald-500" : rate >= 65 ? "bg-amber-500" : "bg-red-500";
  const text = rate >= 85 ? "text-emerald-600" : rate >= 65 ? "text-amber-600" : "text-red-600";
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
