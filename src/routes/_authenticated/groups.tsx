import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X, BookOpen, Users, UserCog, ChevronDown, ChevronUp, UserPlus } from "lucide-react";
import { toast } from "sonner";

type Teacher = { id: string; full_name: string | null; teacher_level: string | null };
type Subject = { id: string; name: string };
type Group = {
  id: string;
  name: string;
  monthly_fee: number;
  schedule: string | null;
  subject_id: string | null;
  teacher_id: string | null;
  subject: { id: string; name: string } | null;
};
type StudentLite = { id: string; first_name: string; last_name: string | null; parent_phone: string | null };
type Enrollment = {
  id: string;
  student_id: string;
  status: string;
  student: StudentLite | null;
};

export const Route = createFileRoute("/_authenticated/groups")({
  component: GroupsPage,
});

function GroupsPage() {
  const { roles } = Route.useRouteContext();
  const isStaff = roles.includes("director") || roles.includes("admin");
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: g }, { data: s }, { data: tr }] = await Promise.all([
      supabase
        .from("groups")
        .select("id, name, monthly_fee, schedule, subject_id, teacher_id, subject:subjects(id, name)")
        .order("name"),
      supabase.from("subjects").select("id, name").order("name"),
      supabase.from("user_roles").select("user_id").eq("role", "teacher"),
    ]);
    setGroups((g as never) ?? []);
    setSubjects(s ?? []);
    const teacherIds = [...new Set(((tr ?? []) as { user_id: string }[]).map((r) => r.user_id))];
    let teacherList: Teacher[] = [];
    if (teacherIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, teacher_level")
        .in("id", teacherIds);
      teacherList = (profs ?? []) as Teacher[];
    }
    setTeachers(
      [...teacherList].sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "")),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    if (!confirm("Guruh o'chirilsinmi? Guruhga biriktirilgan darslar/o'quvchilar avval bo'shatilishi kerak.")) return;
    const { error } = await supabase.from("groups").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Guruh o'chirildi");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Guruhlar</h1>
          <p className="text-sm text-muted-foreground">Fan · O'qituvchi · O'quvchilar bir joyda</p>
        </div>
        {isStaff && (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Guruh qo'shish
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Hozircha guruh yo'q
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              isStaff={isStaff}
              isOpen={expanded === g.id}
              onToggle={() => setExpanded(expanded === g.id ? null : g.id)}
              onEdit={() => setEditing(g)}
              onDelete={() => remove(g.id)}
              teachers={teachers}
            />
          ))}
        </div>
      )}

      {open && (
        <GroupModal
          subjects={subjects}
          teachers={teachers}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            load();
          }}
        />
      )}
      {editing && (
        <GroupModal
          subjects={subjects}
          teachers={teachers}
          initial={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function GroupCard({
  group,
  isStaff,
  isOpen,
  onToggle,
  onEdit,
  onDelete,
  teachers,
}: {
  group: Group;
  isStaff: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  teachers: Teacher[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <BookOpen className="h-8 w-8 text-primary" />
        {isStaff && (
          <div className="flex gap-1">
            <button
              onClick={onEdit}
              className="rounded-md border border-border p-1.5 text-xs hover:border-primary"
              title="Tahrirlash"
            >
              <UserCog className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="rounded-md border border-border p-1.5 text-destructive hover:border-destructive"
              title="O'chirish"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <h3 className="mt-4 text-lg font-bold">{group.name}</h3>
      {(() => {
        const teacherName = group.teacher_id
          ? teachers.find((t) => t.id === group.teacher_id)?.full_name ?? null
          : null;
        return (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
              {group.subject?.name ?? "Fan tanlanmagan"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 ${
                teacherName ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
              }`}
            >
              {teacherName ?? "O'qituvchi biriktirilmagan"}
            </span>
          </div>
        );
      })()}
      {group.schedule && <p className="mt-2 text-xs text-muted-foreground">📅 {group.schedule}</p>}
      <div className="mt-4 border-t border-border pt-3 text-sm">
        Oylik: <b>{Number(group.monthly_fee).toLocaleString()} so'm</b>
      </div>

      <button
        onClick={onToggle}
        className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary"
      >
        <Users className="h-3.5 w-3.5" /> O'quvchilar {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {isOpen && <GroupRoster group={group} isStaff={isStaff} teachers={teachers} />}
    </div>
  );
}

function GroupRoster({ group, isStaff, teachers: _teachers }: { group: Group; isStaff: boolean; teachers: Teacher[] }) {
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [candidates, setCandidates] = useState<StudentLite[]>([]);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("student_enrollments")
      .select("id, student_id, status, student:students(id, first_name, last_name, parent_phone)")
      .eq("group_id", group.id)
      .in("status", ["active", "trial"])
      .order("started_at", { ascending: false });
    setRows((data as never) ?? []);
    setLoading(false);
  }, [group.id]);

  useEffect(() => {
    load();
  }, [load]);

  const loadCandidates = async (term: string) => {
    // Sanitize like search page: strip PostgREST/SQL wildcards
    const clean = term.replace(/[,()%_]/g, " ").replace(/\s+/g, " ").trim().slice(0, 64);
    if (clean.length < 2) {
      setCandidates([]);
      return;
    }
    const like = `%${clean}%`;
    const { data } = await supabase
      .from("students")
      .select("id, first_name, last_name, parent_phone")
      .or(`first_name.ilike.${like},last_name.ilike.${like},parent_phone.ilike.${like}`)
      .limit(10);
    // filter out those already enrolled in this group
    const already = new Set(rows.map((r) => r.student_id));
    setCandidates(((data ?? []) as StudentLite[]).filter((s) => !already.has(s.id)));
  };

  const enroll = async (student_id: string) => {
    const { error } = await supabase.from("student_enrollments").insert({
      student_id,
      group_id: group.id,
      subject_id: group.subject_id,
      teacher_user_id: group.teacher_id,
      monthly_fee: group.monthly_fee,
      status: "active",
    });
    if (error) return toast.error(error.message);
    toast.success("O'quvchi guruhga qo'shildi");
    setSearch("");
    setCandidates([]);
    load();
  };

  const unenroll = async (id: string) => {
    if (!confirm("O'quvchi guruhdan chiqarilsinmi?")) return;
    const { error } = await supabase
      .from("student_enrollments")
      .update({ status: "left", ended_at: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Chiqarildi");
    load();
  };

  return (
    <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
      {loading ? (
        <p className="py-2 text-center text-xs text-muted-foreground">Yuklanmoqda...</p>
      ) : rows.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">Hozircha o'quvchi yo'q</p>
      ) : (
        <ul className="mb-2 max-h-56 space-y-1 overflow-auto">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-2 py-1.5 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">
                  {r.student?.first_name} {r.student?.last_name ?? ""}
                </div>
                {r.student?.parent_phone && <div className="truncate text-muted-foreground">{r.student.parent_phone}</div>}
              </div>
              {isStaff && (
                <button
                  onClick={() => unenroll(r.id)}
                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                  title="Chiqarish"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isStaff && (
        <>
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border px-2 py-1.5 text-xs hover:border-primary"
            >
              <UserPlus className="h-3.5 w-3.5" /> O'quvchi qo'shish
            </button>
          ) : (
            <div className="space-y-2">
              <input
                autoFocus
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  loadCandidates(e.target.value);
                }}
                placeholder="Ism yoki telefon bo'yicha qidirish..."
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
              {candidates.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-auto rounded-md border border-border bg-card p-1">
                  {candidates.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => enroll(c.id)}
                        className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-primary/10"
                      >
                        <span className="truncate">
                          {c.first_name} {c.last_name ?? ""}
                          {c.parent_phone && <span className="ml-1 text-muted-foreground">· {c.parent_phone}</span>}
                        </span>
                        <UserPlus className="h-3 w-3 text-primary" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => {
                  setAdding(false);
                  setSearch("");
                  setCandidates([]);
                }}
                className="w-full rounded-md border border-border px-2 py-1 text-xs hover:border-primary"
              >
                Yopish
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GroupModal({
  subjects,
  teachers,
  initial,
  onClose,
  onDone,
}: {
  subjects: Subject[];
  teachers: Teacher[];
  initial?: Group;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    subject_id: initial?.subject_id ?? subjects[0]?.id ?? "",
    teacher_id: initial?.teacher_id ?? "",
    monthly_fee: initial?.monthly_fee ?? 400000,
    schedule: initial?.schedule ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Suggest teachers whose level matches the subject name (loose match).
  const suggestedTeachers = useMemo(() => {
    const subj = subjects.find((s) => s.id === form.subject_id)?.name.toLowerCase() ?? "";
    if (!subj) return teachers;
    return [...teachers].sort((a, b) => {
      const aMatch = (a.teacher_level ?? "").toLowerCase().includes(subj) ? -1 : 0;
      const bMatch = (b.teacher_level ?? "").toLowerCase().includes(subj) ? -1 : 0;
      return aMatch - bMatch;
    });
  }, [teachers, subjects, form.subject_id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      subject_id: form.subject_id || null,
      teacher_id: form.teacher_id || null,
      monthly_fee: form.monthly_fee,
      schedule: form.schedule.trim() || null,
    };
    const { error } = initial
      ? await supabase.from("groups").update(payload).eq("id", initial.id)
      : await supabase.from("groups").insert(payload);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    toast.success(initial ? "Yangilandi" : "Guruh qo'shildi");
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{initial ? "Guruhni tahrirlash" : "Yangi guruh"}</h2>
          <button onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nomi</div>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
              placeholder="Ingliz-A1-Ertalab"
            />
          </label>
          <label className="block text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fan</div>
            <select
              value={form.subject_id}
              onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
            >
              <option value="">— tanlanmagan —</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              O'qituvchi
            </div>
            <select
              value={form.teacher_id}
              onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
            >
              <option value="">— biriktirilmagan —</option>
              {suggestedTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name ?? "Ismi yo'q"}
                  {t.teacher_level ? ` · ${t.teacher_level}` : ""}
                </option>
              ))}
            </select>
            {teachers.length === 0 && (
              <p className="mt-1 text-xs text-amber-500">
                Hali biror foydalanuvchida <b>teacher</b> roli yo'q. Sozlamalar → O'qituvchilar bo'limidan yarating.
              </p>
            )}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Oylik (so'm)
              </div>
              <input
                required
                type="number"
                value={form.monthly_fee}
                onChange={(e) => setForm({ ...form, monthly_fee: Number(e.target.value) })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
              />
            </label>
            <label className="block text-sm">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Jadval</div>
              <input
                value={form.schedule}
                onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
                placeholder="Du/Chor/Ju 18:00"
              />
            </label>
          </div>
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </p>
          )}
          <button
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "..." : initial ? "Saqlash" : "Qo'shish"}
          </button>
        </form>
      </div>
    </div>
  );
}
