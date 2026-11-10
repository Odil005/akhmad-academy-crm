import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ClipboardList, Save } from "lucide-react";
import { examPercent, examLevel } from "@/lib/exam-score";

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({ meta: [
    { title: "Imtihon jurnali | Akhmad CRM" },
    { name: "description", content: "Oylik imtihon va test natijalarini guruh bo'yicha kiritish." },
    { property: "og:title", content: "Imtihon jurnali | Akhmad CRM" },
    { property: "og:description", content: "Oylik imtihon va test natijalarini guruh bo'yicha kiritish." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ExamsPage,
});

type Group = { id: string; name: string; subject_id: string | null; teacher_id: string | null };
type Row = { id: string; name: string };
type Past = { id: string; student_id: string; score: number; max_score: number | null; comment: string | null; graded_at: string };

function ExamsPage() {
  const { user, roles } = Route.useRouteContext();
  const isStaff = roles.includes("director") || roles.includes("admin");
  const isTeacher = roles.includes("teacher");
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [students, setStudents] = useState<Row[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [title, setTitle] = useState(() => `${new Date().toLocaleDateString("uz-UZ", { month: "long" })} oylik imtihon`);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [max, setMax] = useState("100");
  const [past, setPast] = useState<Past[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let q = supabase.from("groups").select("id, name, subject_id, teacher_id").order("name");
    if (!isStaff) q = q.eq("teacher_id", user.id);
    void q.then(({ data }) => {
      setGroups((data as Group[] | null) ?? []);
      if (data?.[0]) setGroupId(data[0].id);
    });
  }, [isStaff, user.id]);

  const loadGroup = async (gid: string) => {
    const [{ data: enr }, { data: gr }] = await Promise.all([
      supabase.from("student_enrollments")
        .select("student_id, student:students(id, full_name, first_name, last_name)")
        .eq("group_id", gid).in("status", ["active", "trial"]),
      supabase.from("grades").select("id, student_id, score, max_score, comment, graded_at")
        .eq("kind", "exam").order("graded_at", { ascending: false }).limit(300),
    ]);
    const list = ((enr ?? []) as unknown as { student_id: string; student: { full_name: string | null; first_name: string | null; last_name: string | null } | null }[])
      .map((e) => ({ id: e.student_id, name: e.student?.full_name?.trim() || [e.student?.last_name, e.student?.first_name].filter(Boolean).join(" ") || "—" }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setStudents(list);
    const ids = new Set(list.map((s) => s.id));
    setPast(((gr ?? []) as Past[]).filter((g) => ids.has(g.student_id)));
    setScores({});
  };

  useEffect(() => { if (groupId) void loadGroup(groupId); }, [groupId]);

  const group = groups.find((g) => g.id === groupId);
  const maxNum = Number(max) || 100;

  const save = async () => {
    if (!group) return;
    const rows = Object.entries(scores).filter(([, v]) => v.trim() !== "").map(([sid, v]) => ({
      student_id: sid,
      score: Number(v),
      max_score: maxNum,
      kind: "exam",
      comment: title.trim() || null,
      graded_at: date,
      subject_id: group.subject_id,
      teacher_user_id: isTeacher && !isStaff ? user.id : (group.teacher_id ?? user.id),
    }));
    if (!rows.length) return toast.error("Kamida bitta ball kiriting");
    if (rows.some((r) => Number.isNaN(r.score) || r.score < 0 || r.score > maxNum)) return toast.error(`Ball 0 dan ${maxNum} gacha bo'lishi kerak`);
    setSaving(true);
    const { error } = await supabase.from("grades").insert(rows);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} ta natija saqlandi — ota-onalar ilovasida ko'rinadi`);
    void loadGroup(group.id);
  };

  const lastByStudent = useMemo(() => {
    const m = new Map<string, Past>();
    for (const p of past) if (!m.has(p.student_id)) m.set(p.student_id, p);
    return m;
  }, [past]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-extrabold"><ClipboardList className="h-5 w-5 text-primary" /> Imtihon jurnali</h1>
        <p className="text-xs text-muted-foreground">Oylik imtihon yoki test ballarini guruh bo'yicha kiriting. Natija o'quvchi profilida va ota-ona ilovasida ko'rinadi.</p>
      </header>

      <div className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-4">
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Guruh" className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {groups.length === 0 && <option value="">Guruh yo'q</option>}
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Imtihon nomi" aria-label="Imtihon nomi" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Sana" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input type="number" value={max} onChange={(e) => setMax(e.target.value)} aria-label="Maksimal ball" placeholder="Maks. ball" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[11px] uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">O'quvchi</th><th className="px-3 py-2">Oldingi natija</th><th className="px-3 py-2 w-32">Ball / {maxNum}</th></tr>
          </thead>
          <tbody>
            {students.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-xs text-muted-foreground">Bu guruhda o'quvchi yo'q</td></tr>}
            {students.map((s) => {
              const last = lastByStudent.get(s.id);
              const cur = scores[s.id] ?? "";
              const pct = cur !== "" ? examPercent(Number(cur), maxNum) : null;
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {last ? `${examPercent(Number(last.score), Number(last.max_score ?? 100))}% · ${last.graded_at}` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input inputMode="numeric" value={cur} onChange={(e) => setScores({ ...scores, [s.id]: e.target.value })} aria-label={`${s.name} balli`} className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm" />
                      {pct !== null && <span className="text-[11px] text-muted-foreground">{examLevel(pct)}</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button disabled={saving || !group} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
        <Save className="h-4 w-4" /> {saving ? "Saqlanmoqda..." : "Natijalarni saqlash"}
      </button>
    </div>
  );
}
