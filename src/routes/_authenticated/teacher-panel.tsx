import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  GraduationCap,
  Smile,
  ScanFace,
  CalendarDays,
  Users,
  ArrowRight,
  Clock,
  BookOpen,
  Zap,
} from "lucide-react";
import { QuickGradeModal } from "@/components/QuickGradeModal";

const DAYS_FULL = [
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
  "Yakshanba",
];

type Lesson = {
  id: string;
  group_id: string;
  subject_id: string | null;
  room_id: string | null;
  teacher_user_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  group: { name: string } | null;
  subject: { name: string } | null;
  room: { name: string } | null;
};

type GroupInfo = {
  id: string;
  name: string;
  subject: { name: string } | null;
  student_count: number;
};

type RecentGrade = {
  id: string;
  score: number;
  max_score: number;
  kind: string;
  graded_at: string;
  student: { first_name: string; last_name: string | null } | null;
  subject: { name: string } | null;
};

type RecentBehavior = {
  id: string;
  rating: string;
  lesson_date: string;
  student: { profile: { full_name: string | null } | null } | null;
};

export const Route = createFileRoute("/_authenticated/teacher-panel")({
  component: TeacherPanelPage,
});

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function dowFromDate(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

function TeacherPanelPage() {
  const { user, roles } = Route.useRouteContext();
  const isTeacher = roles.includes("teacher");

  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [todayLessons, setTodayLessons] = useState<Lesson[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [recentGrades, setRecentGrades] = useState<RecentGrade[]>([]);
  const [recentBehavior, setRecentBehavior] = useState<RecentBehavior[]>([]);
  const [attendanceToday, setAttendanceToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [quickOpen, setQuickOpen] = useState(false);

  const today = todayISO();
  const dow = dowFromDate(today);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user.id]);

  useEffect(() => {
    if (!isTeacher) return;
    setLoading(true);
    (async () => {
      const [
        { data: lessonsData },
        { data: groupsData },
        { data: gradesData },
        { data: behaviorData },
        { count: attCount },
      ] = await Promise.all([
        supabase
          .from("lessons")
          .select(
            "id, group_id, subject_id, room_id, teacher_user_id, day_of_week, start_time, end_time, group:groups(name), subject:subjects(name), room:rooms(name)"
          )
          .eq("teacher_user_id", user.id)
          .eq("day_of_week", dow)
          .eq("is_active", true)
          .order("start_time"),
        supabase
          .from("groups")
          .select("id, name, subject:subjects(name)")
          .eq("teacher_id", user.id)
          .order("name"),
        supabase
          .from("grades")
          .select(
            "id, score, max_score, kind, graded_at, student:students(first_name, last_name), subject:subjects(name)"
          )
          .eq("teacher_user_id", user.id)
          .order("graded_at", { ascending: false })
          .limit(10),
        supabase
          .from("behavior_evaluations")
          .select(
            "id, rating, lesson_date, student:students(profile:profiles(full_name))"
          )
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("attendance")
          .select("id", { count: "exact", head: true })
          .eq("date", today)
          .eq("marked_by", user.id),
      ]);

      setTodayLessons((lessonsData as never as Lesson[]) ?? []);

      // Count students per group
      const groupList = (groupsData as never as GroupInfo[]) ?? [];
      if (groupList.length > 0) {
        const { data: counts } = await supabase
          .from("students")
          .select("group_id")
          .in(
            "group_id",
            groupList.map((g) => g.id)
          );
        const countMap = new Map<string, number>();
        for (const c of counts ?? []) {
          if (c.group_id) {
            countMap.set(c.group_id, (countMap.get(c.group_id) ?? 0) + 1);
          }
        }
        setGroups(
          groupList.map((g) => ({ ...g, student_count: countMap.get(g.id) ?? 0 }))
        );
      } else {
        setGroups([]);
      }

      setRecentGrades((gradesData as never as RecentGrade[]) ?? []);
      setRecentBehavior((behaviorData as never as RecentBehavior[]) ?? []);
      setAttendanceToday(attCount ?? 0);
      setLoading(false);
    })();
  }, [isTeacher, user.id, dow, today]);

  if (!isTeacher) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Bu sahifa faqat o'qituvchilar uchun.
        </p>
      </div>
    );
  }

  const displayName = profile?.full_name ?? user.email?.split("@")[0] ?? "";

  const quickActions = [
    {
      label: "Davomat",
      desc: "Bugungi davomatni belgilash",
      icon: ClipboardCheck,
      href: "/attendance",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Baho qo'yish",
      desc: "Yangi baho kiritish",
      icon: GraduationCap,
      href: "/grades",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Xulq baholash",
      desc: "O'quvchi xulqini baholash",
      icon: Smile,
      href: "/behavior",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      label: "Face ID",
      desc: "Yuz orqali kirish",
      icon: ScanFace,
      href: "/face-id",
      color: "text-sky-500",
      bg: "bg-sky-500/10",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
            Salom, {displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bugun: {new Date().toLocaleDateString("uz-UZ", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={() => setQuickOpen(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-transform hover:scale-[1.02]"
        >
          <Zap className="h-4 w-4" /> Tez baho
        </button>
      </header>


      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Tezkor amallar
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {quickActions.map((a) => (
            <Link
              key={a.label}
              to={a.href}
              className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <div
                className={`grid h-10 w-10 place-items-center rounded-xl ${a.bg}`}
              >
                <a.icon className={`h-5 w-5 ${a.color}`} />
              </div>
              <div className="mt-3 text-sm font-bold">{a.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {a.desc}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Today's Schedule + Groups side by side on desktop */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's Lessons */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Bugungi darslar
            </h2>
            <Link
              to="/schedule"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              To'liq jadval <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
            ) : todayLessons.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                Bugun dars yo'q
              </div>
            ) : (
              todayLessons.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">
                      {l.group?.name ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {l.subject?.name ?? "—"}
                      {l.room?.name ? ` · ${l.room.name}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-mono font-bold text-primary">
                      {l.start_time.slice(0, 5)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {l.end_time.slice(0, 5)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* My Groups */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Mening guruhlarim
            </h2>
            <Link
              to="/groups"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Barchasi <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
            ) : groups.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                Guruh biriktirilmagan
              </div>
            ) : (
              groups.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{g.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {g.subject?.name ?? "Fan biriktirilmagan"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-bold text-primary">
                      {g.student_count}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Bugun qilingan ishlar
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Davomat yozuvlari"
            value={attendanceToday}
            icon={ClipboardCheck}
            color="text-emerald-500"
          />
          <StatCard
            label="Oxirgi 7 kun baho"
            value={recentGrades.length}
            icon={GraduationCap}
            color="text-primary"
          />
          <StatCard
            label="Xulq baholari"
            value={recentBehavior.length}
            icon={Smile}
            color="text-amber-500"
          />
        </div>
      </div>

      {/* Recent Grades & Behavior */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Grades */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Oxirgi baholar
            </h3>
            <Link
              to="/grades"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Barchasi <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentGrades.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Hozircha baho yo'q
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentGrades.map((g) => {
                const pct = Math.round((g.score / g.max_score) * 100);
                return (
                  <li
                    key={g.id}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <div
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-extrabold ${
                        pct >= 70
                          ? "bg-emerald-500/10 text-emerald-500"
                          : pct >= 50
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {pct}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {g.student?.first_name} {g.student?.last_name ?? ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {g.subject?.name ?? "—"} · {kindLabel(g.kind)}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {g.graded_at}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent Behavior */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Oxirgi xulq baholari
            </h3>
            <Link
              to="/behavior"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Barchasi <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentBehavior.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Hozircha baho yo'q
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentBehavior.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {b.student?.profile?.full_name ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {b.lesson_date}
                    </div>
                  </div>
                  <BehaviorBadge rating={b.rating} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {quickOpen && (
        <QuickGradeModal
          userId={user.id}
          isStaff={false}
          onClose={() => setQuickOpen(false)}
        />
      )}
    </div>
  );
}


function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center">
      <Icon className={`mx-auto h-5 w-5 ${color}`} />
      <div className="mt-2 text-2xl font-extrabold">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function kindLabel(k: string): string {
  const map: Record<string, string> = {
    lesson: "Dars",
    homework: "Uy vaz.",
    quiz: "Nazorat",
    exam: "Imtihon",
  };
  return map[k] ?? k;
}

function BehaviorBadge({ rating }: { rating: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    qoniqarsiz: { label: "Qoniqarsiz", cls: "bg-red-500/10 text-red-500" },
    qoniqarli: { label: "Qoniqarli", cls: "bg-yellow-500/10 text-yellow-600" },
    yaxshi: { label: "Yaxshi", cls: "bg-blue-500/10 text-blue-500" },
    alo: { label: "A'lo", cls: "bg-emerald-500/10 text-emerald-500" },
  };
  const m = map[rating] ?? { label: rating, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}
