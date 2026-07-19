import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X, GraduationCap, Zap } from "lucide-react";
import { toast } from "sonner";
import { QuickGradeModal } from "@/components/QuickGradeModal";

type Group = { id: string; name: string };
type Student = { id: string; first_name: string; last_name: string | null; group_id: string | null };
type Lesson = { id: string; group_id: string; teacher_user_id: string | null; subject_id: string | null; day_of_week: number; start_time: string; subject: { name: string } | null };
type Grade = {
  id: string;
  student_id: string;
  score: number;
  max_score: number;
  kind: string;
  comment: string | null;
  graded_at: string;
  student: { first_name: string; last_name: string | null } | null;
  subject: { name: string } | null;
};

const KIND_LABEL: Record<string, string> = { lesson: "Dars", homework: "Uy vaz.", quiz: "Nazorat", exam: "Imtihon" };

export const Route = createFileRoute("/_authenticated/grades")({
  component: GradesPage,
});

function GradesPage() {
  const { user, roles } = Route.useRouteContext();
  const isStaff = roles.includes("director") || roles.includes("admin");
  const isTeacher = roles.includes("teacher");
  const isStudent = roles.includes("student") && !isStaff && !isTeacher;
  const canGrade = isStaff || isTeacher;

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    if (isStudent) {
      const { data: st } = await supabase.from("students").select("id").eq("profile_id", user.id).maybeSingle();
      if (!st) { setGrades([]); setLoading(false); return; }
      const { data } = await supabase
        .from("grades")
        .select("id, student_id, score, max_score, kind, comment, graded_at, student:students(first_name,last_name), subject:subjects(name)")
        .eq("student_id", (st as { id: string }).id)
        .order("graded_at", { ascending: false })
        .limit(200);
      setGrades((data as never as Grade[]) ?? []);
    } else {
      let q = supabase
        .from("grades")
        .select("id, student_id, score, max_score, kind, comment, graded_at, student:students(first_name,last_name,group_id), subject:subjects(name)")
        .order("graded_at", { ascending: false })
        .limit(200);
      if (!isStaff && isTeacher) q = q.eq("teacher_user_id", user.id);
      const { data } = await q;
      let rows = ((data as never as (Grade & { student: (Grade["student"] & { group_id?: string | null }) })[] ) ?? []);
      if (groupId) rows = rows.filter((g) => g.student?.group_id === groupId);
      setGrades(rows);
    }
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("groups").select("id, name").order("name");
      setGroups((data as Group[] | null) ?? []);
    })();
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [groupId, isStudent, isTeacher, isStaff]);

  const avg = useMemo(() => {
    if (grades.length === 0) return 0;
    const s = grades.reduce((a, g) => a + (g.score / g.max_score) * 100, 0);
    return Math.round(s / grades.length);
  }, [grades]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Baholar</h1>
          <p className="text-sm text-muted-foreground">
            {isStudent ? "Sizning baholaringiz" : "O'quvchi baholari"}
          </p>
        </div>
        {canGrade && (
          <div className="flex shrink-0 gap-2">
            <button onClick={() => setQuickOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20">
              <Zap className="h-4 w-4" /> Tez baho
            </button>
            <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-semibold">
              <Plus className="h-4 w-4" /> Qo'lda
            </button>
          </div>
        )}
      </div>


      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Jami baho" value={grades.length} />
        <Stat label="O'rtacha %" value={`${avg}%`} color={avg >= 70 ? "text-emerald-500" : avg >= 50 ? "text-amber-500" : "text-destructive"} />
      </div>

      {!isStudent && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Guruh filtri</div>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
            <option value="">Barcha guruhlar</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
      ) : grades.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Baholar yo'q
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {grades.map((g) => {
              const pct = Math.round((g.score / g.max_score) * 100);
              return (
                <li key={g.id} className="flex items-center gap-3 p-3">
                  <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl font-extrabold ${pct >= 70 ? "bg-emerald-500/10 text-emerald-500" : pct >= 50 ? "bg-amber-500/10 text-amber-500" : "bg-destructive/10 text-destructive"}`}>
                    {pct}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {g.student?.first_name} {g.student?.last_name ?? ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {g.subject?.name ?? "—"} · {KIND_LABEL[g.kind] ?? g.kind} · {g.graded_at}
                    </div>
                    {g.comment && <div className="mt-0.5 text-xs">{g.comment}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold">{g.score}/{g.max_score}</div>
                    {canGrade && (
                      <button
                        onClick={async () => {
                          if (!confirm("O'chirilsinmi?")) return;
                          await supabase.from("grades").delete().eq("id", g.id);
                          load();
                        }}
                        className="mt-1 text-destructive hover:opacity-70"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {open && <NewGradeModal userId={user.id} isStaff={isStaff} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); toast.success("Saqlandi"); }} />}
      {quickOpen && <QuickGradeModal userId={user.id} isStaff={isStaff} onClose={() => setQuickOpen(false)} onDone={() => load()} />}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <div className={`text-2xl font-extrabold ${color ?? "text-primary"}`}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function NewGradeModal({ userId, isStaff, onClose, onDone }: { userId: string; isStaff: boolean; onClose: () => void; onDone: () => void }) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState({ student_id: "", score: 80, max_score: 100, kind: "lesson", comment: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      let q = supabase
        .from("lessons")
        .select("id, group_id, teacher_user_id, subject_id, day_of_week, start_time, subject:subjects(name)")
        .eq("is_active", true).order("day_of_week").order("start_time");
      if (!isStaff) q = q.eq("teacher_user_id", userId);
      const { data } = await q;
      setLessons((data as never as Lesson[]) ?? []);
    })();
  }, [userId, isStaff]);

  useEffect(() => {
    if (!lessonId) { setStudents([]); return; }
    const l = lessons.find((x) => x.id === lessonId);
    if (!l) return;
    (async () => {
      const { data } = await supabase.from("students").select("id, first_name, last_name, group_id").eq("group_id", l.group_id).order("first_name");
      setStudents((data as Student[] | null) ?? []);
    })();
  }, [lessonId, lessons]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const l = lessons.find((x) => x.id === lessonId);
    if (!l || !form.student_id) { setError("Dars va o'quvchini tanlang"); setLoading(false); return; }
    const { error } = await supabase.from("grades").insert({
      student_id: form.student_id,
      lesson_id: l.id,
      subject_id: l.subject_id,
      teacher_user_id: l.teacher_user_id ?? userId,
      score: form.score,
      max_score: form.max_score,
      kind: form.kind,
      comment: form.comment || null,
    });
    if (error) { setError(error.message); setLoading(false); return; }
    onDone();
  };

  const DOW = ["Du","Se","Ch","Pa","Ju","Sh","Ya"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-bold"><GraduationCap className="h-5 w-5 text-primary" /> Yangi baho</div>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <select required value={lessonId} onChange={(e) => setLessonId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
            <option value="">Darsni tanlang</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {DOW[l.day_of_week - 1]} {l.start_time.slice(0,5)} · {l.subject?.name ?? "—"}
              </option>
            ))}
          </select>
          <select required disabled={!lessonId} value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm disabled:opacity-60">
            <option value="">O'quvchini tanlang</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name ?? ""}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <input required type="number" step="0.1" min={0} value={form.score} onChange={(e) => setForm({ ...form, score: Number(e.target.value) })} placeholder="Baho" className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
            <input required type="number" step="0.1" min={1} value={form.max_score} onChange={(e) => setForm({ ...form, max_score: Number(e.target.value) })} placeholder="Max" className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-2.5 text-sm">
              <option value="lesson">Dars</option>
              <option value="homework">Uy vaz.</option>
              <option value="quiz">Nazorat</option>
              <option value="exam">Imtihon</option>
            </select>
          </div>
          <textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="Izoh" rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {loading ? "..." : "Saqlash"}
          </button>
        </form>
      </div>
    </div>
  );
}
