import { useEffect, useState } from "react";
import { X, Zap, MessageCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendParentTelegram } from "@/lib/notifications.functions";

type Lesson = {
  id: string;
  group_id: string;
  teacher_user_id: string | null;
  subject_id: string | null;
  day_of_week: number;
  start_time: string;
  subject: { name: string } | null;
};

type Student = {
  id: string;
  first_name: string;
  last_name: string | null;
  parent_telegram_chat_id: string | null;
  parent_notifications_enabled: boolean;
};

export const RATINGS = [
  { key: "unsatisfactory", label: "Qoniqarsiz", short: "😞", score: 2, bg: "bg-red-500", ring: "ring-red-500/40", text: "text-white" },
  { key: "satisfactory", label: "Qoniqarli", short: "🙂", score: 3, bg: "bg-amber-500", ring: "ring-amber-500/40", text: "text-white" },
  { key: "good", label: "Yaxshi", short: "😊", score: 4, bg: "bg-sky-500", ring: "ring-sky-500/40", text: "text-white" },
  { key: "excellent", label: "A'lo", short: "🌟", score: 5, bg: "bg-emerald-500", ring: "ring-emerald-500/40", text: "text-white" },
] as const;

const DEFAULT_TEMPLATE =
  "Assalomu alaykum! Farzandingiz {student} bugungi {subject} darsida {rating} baho oldi ({score}/{max}). Sana: {date}. Akhmad Academy.";

const DOW = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

export function QuickGradeModal({
  userId,
  isStaff,
  onClose,
  onDone,
}: {
  userId: string;
  isStaff: boolean;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [template, setTemplate] = useState<string>(DEFAULT_TEMPLATE);
  const [saving, setSaving] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const sendTg = useServerFn(sendParentTelegram);

  useEffect(() => {
    (async () => {
      let q = supabase
        .from("lessons")
        .select("id, group_id, teacher_user_id, subject_id, day_of_week, start_time, subject:subjects(name)")
        .eq("is_active", true)
        .order("day_of_week")
        .order("start_time");
      if (!isStaff) q = q.eq("teacher_user_id", userId);
      const { data } = await q;
      setLessons((data as never as Lesson[]) ?? []);

      const { data: setting } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "parent_grade_template")
        .maybeSingle();
      const tpl = (setting?.value as { text?: string } | null)?.text;
      if (tpl && typeof tpl === "string" && tpl.trim()) setTemplate(tpl);
    })();
  }, [userId, isStaff]);

  useEffect(() => {
    if (!lessonId) {
      setStudents([]);
      setStudentId("");
      return;
    }
    const l = lessons.find((x) => x.id === lessonId);
    if (!l) return;
    (async () => {
      const { data } = await supabase
        .from("students")
        .select("id, first_name, last_name, parent_telegram_chat_id, parent_notifications_enabled")
        .eq("group_id", l.group_id)
        .order("first_name");
      setStudents((data as Student[] | null) ?? []);
    })();
  }, [lessonId, lessons]);

  const lesson = lessons.find((l) => l.id === lessonId);
  const student = students.find((s) => s.id === studentId);

  const submit = async (rating: (typeof RATINGS)[number]) => {
    if (!lesson || !student) {
      toast.error("Dars va o'quvchini tanlang");
      return;
    }
    setSaving(rating.key);
    try {
      const { error } = await supabase.from("grades").insert({
        student_id: student.id,
        lesson_id: lesson.id,
        subject_id: lesson.subject_id,
        teacher_user_id: lesson.teacher_user_id ?? userId,
        score: rating.score,
        max_score: 5,
        kind: "lesson",
        comment: rating.label,
      });
      if (error) throw error;

      if (notify && student.parent_notifications_enabled && student.parent_telegram_chat_id) {
        const text = template
          .replaceAll("{student}", `${student.first_name} ${student.last_name ?? ""}`.trim())
          .replaceAll("{subject}", lesson.subject?.name ?? "—")
          .replaceAll("{rating}", rating.label)
          .replaceAll("{score}", String(rating.score))
          .replaceAll("{max}", "5")
          .replaceAll("{date}", new Date().toISOString().slice(0, 10));
        try {
          await sendTg({ data: { student_id: student.id, text, kind: "grade" } });
          toast.success(`${rating.label} · ota-onaga xabar yuborildi`);
        } catch (e: unknown) {
          toast.success(`${rating.label} saqlandi`);
          toast.error("Telegram: " + (e instanceof Error ? e.message : "xato"));
        }
      } else {
        toast.success(`${rating.label} saqlandi`);
      }
      setStudentId("");
      onDone?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Xato");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-bold">
            <Zap className="h-5 w-5 text-primary" /> Tez baholash
          </div>
          <button onClick={onClose} aria-label="Yopish">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <select
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
          >
            <option value="">Darsni tanlang</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {DOW[l.day_of_week - 1]} {l.start_time.slice(0, 5)} · {l.subject?.name ?? "—"}
              </option>
            ))}
          </select>

          <select
            disabled={!lessonId}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm disabled:opacity-60"
          >
            <option value="">O'quvchini tanlang</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name ?? ""}
                {!s.parent_telegram_chat_id ? " · (TG yo'q)" : ""}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 rounded-lg border border-border bg-background p-2.5 text-xs">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="h-4 w-4"
            />
            <MessageCircle className="h-4 w-4 text-primary" />
            <span>Ota-onaga Telegram xabar yuborilsin</span>
          </label>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {RATINGS.map((r) => (
              <button
                key={r.key}
                disabled={!student || saving !== null}
                onClick={() => submit(r)}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-4 text-sm font-bold shadow-lg transition-all disabled:opacity-40 disabled:shadow-none ${r.bg} ${r.text} hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-4 ${r.ring}`}
              >
                <span className="text-2xl">{r.short}</span>
                <span>
                  {saving === r.key ? "..." : r.label}
                </span>
                <span className="text-[10px] opacity-80">{r.score}/5</span>
              </button>
            ))}
          </div>

          {student && !student.parent_telegram_chat_id && notify && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-600">
              Bu o'quvchining ota-onasi Telegram ulanmagan — faqat baho saqlanadi.
            </p>
          )}
          {student && student.parent_telegram_chat_id && (
            <p className="flex items-center gap-1 text-[11px] text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Ota-ona Telegram ulangan
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
