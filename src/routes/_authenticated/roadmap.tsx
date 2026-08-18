import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Flag, Loader2, Plus, Target, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isStaff as hasStaffRole } from "@/lib/authz";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/roadmap")({
  component: RoadmapPage,
  head: () => ({
    meta: [
      { title: "Maqsad xaritasi · Akhmad Academy" },
      {
        name: "description",
        content:
          "O'quvchining maqsadlari va bosqichlari: har bir qadamni belgilab, natijaga erishish xaritasini kuzatib boring.",
      },
      { property: "og:title", content: "Maqsad xaritasi · Akhmad Academy" },
      {
        property: "og:description",
        content: "O'quvchi maqsadlari va bajarilgan bosqichlar xaritasi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Step = { id: string; title: string; position: number; done: boolean; due_date: string | null };
type Goal = {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: string;
  steps: Step[];
};
type StudentOption = { id: string; first_name: string; last_name: string | null };

function RoadmapPage() {
  const { user, roles } = Route.useRouteContext();
  const canEdit = hasStaffRole(roles) || roles.includes("teacher");
  const db = supabase as never as { from: (t: string) => any };

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      if (canEdit) {
        const { data } = await db
          .from("students")
          .select("id, first_name, last_name")
          .order("first_name")
          .limit(300);
        const list = (data ?? []) as StudentOption[];
        setStudents(list);
        setStudentId(list[0]?.id ?? null);
      } else {
        const { data: me } = await db
          .from("students")
          .select("id, first_name, last_name")
          .eq("profile_id", user.id)
          .maybeSingle();
        setStudentId(me?.id ?? null);
      }
      setLoading(false);
    })();
  }, [canEdit, db, user.id]);

  const loadGoals = useCallback(
    async (sid: string) => {
      setLoading(true);
      const { data } = await db
        .from("student_goals")
        .select(
          "id, title, description, target_date, status, steps:student_goal_steps(id, title, position, done, due_date)",
        )
        .eq("student_id", sid)
        .order("created_at", { ascending: false });
      setGoals(
        ((data ?? []) as Goal[]).map((g) => ({
          ...g,
          steps: [...(g.steps ?? [])].sort((a, b) => a.position - b.position),
        })),
      );
      setLoading(false);
    },
    [db],
  );

  useEffect(() => {
    if (studentId) void loadGoals(studentId);
  }, [studentId, loadGoals]);

  const addGoal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!studentId) return toast.error("O'quvchi tanlanmagan");
    setSaving(true);
    const { data, error } = await db
      .from("student_goals")
      .insert({
        student_id: studentId,
        title: title.trim(),
        target_date: targetDate || null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }
    const steps = stepsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (steps.length) {
      await db
        .from("student_goal_steps")
        .insert(steps.map((s, i) => ({ goal_id: data.id, title: s, position: i })));
    }
    toast.success("Maqsad qo'shildi");
    setTitle("");
    setTargetDate("");
    setStepsText("");
    setSaving(false);
    void loadGoals(studentId);
  };

  const toggleStep = async (goalId: string, step: Step) => {
    const done = !step.done;
    setGoals((items) =>
      items.map((g) =>
        g.id === goalId
          ? { ...g, steps: g.steps.map((s) => (s.id === step.id ? { ...s, done } : s)) }
          : g,
      ),
    );
    const { error } = await db
      .from("student_goal_steps")
      .update({ done, done_at: done ? new Date().toISOString() : null })
      .eq("id", step.id);
    if (error) {
      toast.error(error.message);
      if (studentId) void loadGoals(studentId);
    }
  };

  const removeGoal = async (id: string) => {
    if (!confirm("Maqsad o'chirilsinmi?")) return;
    const { error } = await db.from("student_goals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setGoals((items) => items.filter((g) => g.id !== id));
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Maqsad xaritasi</h1>
          <p className="text-sm text-muted-foreground">
            Maqsad va bosqichlar: har bir qadam bajarilgach xarita to'ldiriladi.
          </p>
        </div>
        {canEdit && students.length > 0 && (
          <select
            value={studentId ?? ""}
            onChange={(e) => setStudentId(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name ?? ""}
              </option>
            ))}
          </select>
        )}
      </header>

      {canEdit && (
        <form onSubmit={addGoal} className="grid gap-3 rounded-2xl border border-border bg-card p-5 md:grid-cols-2">
          <label className="text-sm">
            Maqsad
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="IELTS 7.0 ga erishish"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Muddat
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm md:col-span-2">
            Bosqichlar (har bir qatorda bittasi)
            <textarea
              rows={4}
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              placeholder={"Grammatika asoslari\nListening 6.5\nMock test"}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <button
            disabled={saving}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Maqsad qo'shish
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
      ) : !studentId ? (
        <p className="text-sm text-muted-foreground">
          Profilingiz o'quvchi kartasiga bog'lanmagan, shuning uchun xarita bo'sh.
        </p>
      ) : goals.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          <Target className="mx-auto mb-3 h-8 w-8 opacity-50" />
          Hozircha maqsad belgilanmagan.
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const done = goal.steps.filter((s) => s.done).length;
            const pct = goal.steps.length ? Math.round((done / goal.steps.length) * 100) : 0;
            return (
              <article key={goal.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 font-bold">
                      <Flag className="h-4 w-4 text-primary" /> {goal.title}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {done}/{goal.steps.length} bosqich · {pct}%
                      {goal.target_date && ` · muddat ${goal.target_date}`}
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => void removeGoal(goal.id)}
                      className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                      aria-label="O'chirish"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <ol className="mt-4 space-y-2">
                  {goal.steps.map((step, i) => (
                    <li key={step.id} className="flex items-center gap-3 text-sm">
                      <button
                        onClick={() => void toggleStep(goal.id, step)}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition ${
                          step.done
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-border hover:border-primary"
                        }`}
                      >
                        {i + 1}
                      </button>
                      <span className={step.done ? "text-muted-foreground line-through" : ""}>
                        {step.title}
                      </span>
                    </li>
                  ))}
                </ol>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
