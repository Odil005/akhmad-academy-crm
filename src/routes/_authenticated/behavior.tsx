import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Smile, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/behavior")({
  component: BehaviorPage,
});

const RATINGS = [
  { value: "qoniqarsiz", label: "Passiv", color: "bg-red-500", text: "text-red-500" },
  { value: "qoniqarli", label: "Qatnashdi", color: "bg-yellow-500", text: "text-yellow-500" },
  { value: "yaxshi", label: "Faol", color: "bg-blue-500", text: "text-blue-500" },
  { value: "alo", label: "Juda faol", color: "bg-green-500", text: "text-green-500" },
] as const;

type Student = { id: string; profile: { full_name: string | null } | null; group_id: string | null };

function BehaviorPage() {
  const { user, roles } = Route.useRouteContext();
  const isTeacher = roles.includes("teacher");
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [ratings, setRatings] = useState<Record<string, { rating: string; comment: string }>>({});
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("groups").select("id, name").eq("teacher_id", user.id).order("name").then(({ data }) => {
      setGroups(data ?? []);
      if (data?.[0]) setSelectedGroup(data[0].id);
    });
  }, [user.id]);

  useEffect(() => {
    if (!selectedGroup) return;
    supabase
      .from("students")
      .select("id, group_id, profile:profiles(full_name)")
      .eq("group_id", selectedGroup)
      .then(({ data }) => setStudents((data as any) ?? []));
    supabase
      .from("behavior_evaluations")
      .select("id, rating, comment, lesson_date, student:students(profile:profiles(full_name))")
      .eq("teacher_id", user.id)
      .eq("group_id", selectedGroup)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setHistory(data ?? []));
  }, [selectedGroup, user.id]);

  const submit = async (studentId: string) => {
    const r = ratings[studentId];
    if (!r?.rating) return toast.error("Faollik holatini tanlang");
    const { error } = await supabase.from("behavior_evaluations").insert({
      student_id: studentId,
      teacher_id: user.id,
      group_id: selectedGroup,
      rating: r.rating as any,
      comment: r.comment || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Faollik qaydi saqlandi");
    setRatings((s) => ({ ...s, [studentId]: { rating: "", comment: "" } }));
  };

  if (!isTeacher) {
    return <p className="text-sm text-muted-foreground">Bu sahifa faqat o'qituvchilar uchun.</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold md:text-3xl">
          <Smile className="h-6 w-6 text-primary" /> Darsdagi faollik
        </h1>
        <p className="text-sm text-muted-foreground">Dars oxirida har bir o'quvchining ishtiroki va faolligini qayd eting</p>
      </header>

      <div className="max-w-sm">
        <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
          <option value="">— Guruh tanlang —</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {selectedGroup && (
        <div className="space-y-3">
          {students.length === 0 && <p className="text-sm text-muted-foreground">Bu guruhda o'quvchi yo'q</p>}
          {students.map((s) => {
            const cur = ratings[s.id] ?? { rating: "", comment: "" };
            return (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 font-semibold">{s.profile?.full_name || "—"}</div>
                <div className="flex flex-wrap gap-2">
                  {RATINGS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setRatings({ ...ratings, [s.id]: { ...cur, rating: r.value } })}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        cur.rating === r.value ? `${r.color} text-white border-transparent` : "border-border"
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${r.color}`} /> {r.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    placeholder="Izoh (ixtiyoriy)"
                    value={cur.comment}
                    onChange={(e) => setRatings({ ...ratings, [s.id]: { ...cur, comment: e.target.value } })}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <button onClick={() => submit(s.id)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                    <Send className="h-3.5 w-3.5" /> Saqlash
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">Oxirgi faollik qaydlari</h3>
          <ul className="divide-y divide-border">
            {history.map((h) => {
              const r = RATINGS.find((x) => x.value === h.rating);
              return (
                <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate">{h.student?.profile?.full_name || "—"}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${r?.color ?? "bg-muted"}`}>{r?.label}</span>
                  <span className="text-xs text-muted-foreground">{h.lesson_date}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
