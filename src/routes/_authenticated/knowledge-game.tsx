import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Brain, CheckCircle2, Loader2, RotateCcw, Trophy, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSubjectQuiz } from "@/lib/quiz.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/knowledge-game")({
  component: KnowledgeGamePage,
  head: () => ({
    meta: [
      { title: "Bilim o'yini · Akhmad Academy" },
      {
        name: "description",
        content:
          "Akhmad Academy o'quvchilari uchun fan bo'yicha intellektual test o'yini va ball tarixi.",
      },
      { property: "og:title", content: "Bilim o'yini · Akhmad Academy" },
      {
        property: "og:description",
        content: "Fan tanlang, savollarga javob bering va ball to'plang.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Subject = { id: string; name: string };
type Question = {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};
type Attempt = {
  id: string;
  subject_name: string | null;
  score: number;
  total: number;
  points: number;
  played_at: string;
};

function KnowledgeGamePage() {
  const { user } = Route.useRouteContext();
  const db = supabase as never as {
    from: (t: string) => any;
  };
  const loadQuiz = useServerFn(getSubjectQuiz);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [level, setLevel] = useState(1);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  const loadAttempts = useCallback(
    async (sid: string) => {
      const { data } = await db
        .from("quiz_attempts")
        .select("id, subject_name, score, total, points, played_at")
        .eq("student_id", sid)
        .order("played_at", { ascending: false })
        .limit(8);
      setAttempts((data ?? []) as Attempt[]);
    },
    [db],
  );

  useEffect(() => {
    void (async () => {
      const [{ data: subs }, { data: me }] = await Promise.all([
        db.from("subjects").select("id, name").order("name"),
        db.from("students").select("id").eq("profile_id", user.id).maybeSingle(),
      ]);
      const list = (subs ?? []) as Subject[];
      setSubjects(list);
      setSubjectId(list[0]?.id ?? "");
      if (me?.id) {
        setStudentId(me.id);
        void loadAttempts(me.id);
      }
    })();
  }, [db, loadAttempts, user.id]);

  const subjectName = useMemo(
    () => subjects.find((s) => s.id === subjectId)?.name ?? "Umumiy bilim",
    [subjects, subjectId],
  );

  const start = async () => {
    setLoading(true);
    try {
      const result = await loadQuiz({
        data: { subject_id: subjectId || null, subject_name: subjectName, level, count: 8 },
      });
      if (!result.questions.length) {
        toast.error("Savol topilmadi, keyinroq urinib ko'ring");
      } else {
        setQuestions(result.questions);
        setIndex(0);
        setPicked(null);
        setScore(0);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "O'yin boshlanmadi");
    }
    setLoading(false);
  };

  const answer = (option: number) => {
    if (picked !== null || !questions) return;
    setPicked(option);
    if (option === questions[index].correct_index) setScore((s) => s + 1);
  };

  const next = async () => {
    if (!questions) return;
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setPicked(null);
      return;
    }
    const points = score * (10 * level);
    if (studentId) {
      await db.from("quiz_attempts").insert({
        student_id: studentId,
        subject_id: subjectId || null,
        subject_name: subjectName,
        score,
        total: questions.length,
        points,
      });
      void loadAttempts(studentId);
    }
    toast.success(`Natija: ${score}/${questions.length} · ${points} ball`);
    setQuestions(null);
  };

  const current = questions?.[index];
  const totalPoints = attempts.reduce((sum, a) => sum + a.points, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Bilim o'yini</h1>
          <p className="text-sm text-muted-foreground">
            Fan tanlang, savollarga javob bering va ball to'plang.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold">
          <Trophy className="h-4 w-4 text-amber-500" /> {totalPoints} ball
        </div>
      </header>

      {!current ? (
        <div className="grid gap-4 rounded-2xl border border-border bg-card p-6 md:grid-cols-3">
          <label className="text-sm md:col-span-1">
            Fan
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              {subjects.length ? (
                subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              ) : (
                <option value="">Umumiy bilim</option>
              )}
            </select>
          </label>
          <label className="text-sm">
            Daraja
            <select
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value={1}>1 · Oson</option>
              <option value={2}>2 · O'rta</option>
              <option value={3}>3 · Qiyin</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              onClick={() => void start()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
              O'yinni boshlash
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {subjectName} · {index + 1}/{questions?.length}
            </span>
            <span>To'g'ri: {score}</span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${((index + 1) / (questions?.length ?? 1)) * 100}%` }}
            />
          </div>
          <h2 className="mt-5 text-lg font-bold">{current.question}</h2>
          <div className="mt-4 grid gap-2">
            {current.options.map((option, i) => {
              const isCorrect = i === current.correct_index;
              const state =
                picked === null
                  ? "border-border hover:border-primary"
                  : isCorrect
                    ? "border-emerald-500 bg-emerald-500/10"
                    : picked === i
                      ? "border-destructive bg-destructive/10"
                      : "border-border opacity-60";
              return (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  disabled={picked !== null}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition ${state}`}
                >
                  <span>{option}</span>
                  {picked !== null && isCorrect && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                  {picked === i && !isCorrect && <XCircle className="h-4 w-4 text-destructive" />}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className="mt-4 space-y-3">
              {current.explanation && (
                <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  {current.explanation}
                </p>
              )}
              <button
                onClick={() => void next()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
              >
                {index + 1 < (questions?.length ?? 0) ? "Keyingi savol" : "Natijani saqlash"}
              </button>
            </div>
          )}
        </div>
      )}

      {attempts.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 font-bold">
            <RotateCcw className="h-4 w-4 text-primary" /> Oxirgi natijalar
          </h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <span>{a.subject_name ?? "Fan"}</span>
                <span className="text-muted-foreground">
                  {a.score}/{a.total} · {a.points} ball ·{" "}
                  {new Date(a.played_at).toLocaleDateString("uz-UZ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!studentId && (
        <p className="text-xs text-muted-foreground">
          Natijalar saqlanishi uchun profilingiz o'quvchi kartasiga bog'langan bo'lishi kerak.
        </p>
      )}
    </div>
  );
}
