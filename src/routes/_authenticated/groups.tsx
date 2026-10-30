import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  X,
  BookOpen,
  Users,
  UserCog,
  ChevronDown,
  ChevronUp,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { GroupStudentDialog } from "@/components/GroupStudentDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GROUP_WEEK_DAYS, groupWeekSchedule } from "@/features/schedule/group-week";
import { TelegramIdButton } from "@/components/TelegramIdButton";
import { LowIncomeBadge } from "@/components/LowIncomeBadge";
import { emitDataChanged, useDataEvent } from "@/lib/data-events";

type Teacher = { id: string; full_name: string | null; teacher_level: string | null };
type Subject = { id: string; name: string };
type Group = {
  id: string;
  name: string;
  monthly_fee: number;
  schedule: string | null;
  schedule_days: number[];
  schedule_start: string | null;
  schedule_end: string | null;
  subject_id: string | null;
  teacher_id: string | null;
  subject: { id: string; name: string } | null;
};
type StudentLite = {
  id: string;
  first_name: string;
  last_name: string | null;
  parent_phone: string | null;
  low_income?: boolean | null;
  low_income_note?: string | null;
};
type Enrollment = {
  id: string;
  student_id: string;
  status: string;
  student: StudentLite | null;
};

export const Route = createFileRoute("/_authenticated/groups")({
  head: () => ({ meta: [
    { title: 'Guruhlar | Akhmad CRM' },
    { name: "description", content: 'Akhmad CRM — guruhlar va o‘quv markazini boshqarish.' },
    { property: "og:title", content: 'Guruhlar | Akhmad CRM' },
    { property: "og:description", content: 'Akhmad CRM — guruhlar va o‘quv markazini boshqarish.' },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  validateSearch: (search: Record<string, unknown>): { group?: string; add?: boolean } => ({
    group: typeof search.group === "string" ? search.group : undefined,
    add: search.add === true || search.add === "1" || search.add === "true" ? true : undefined,
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const { roles } = Route.useRouteContext();
  const isStaff = roles.includes("director") || roles.includes("admin");
  const isTeacher = roles.includes("teacher");
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const search = Route.useSearch();
  const [addingTo, setAddingTo] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!search.group) return;
    setExpanded(search.group);
    if (search.add) setAddingTo(search.group);
    const t = setTimeout(() => document.getElementById(`group-${search.group}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    return () => clearTimeout(t);
  }, [search.group, search.add]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: g }, { data: s }, { data: tr }] = await Promise.all([
      supabase
        .from("groups")
        .select(
          "id, name, monthly_fee, schedule, schedule_days, schedule_start, schedule_end, subject_id, teacher_id, subject:subjects(id, name)",
        )
        .order("name"),
      supabase.from("subjects").select("id, name").order("name"),
      supabase.from("user_roles").select("user_id").eq("role", "teacher"),
    ]);
    setGroups((g as never) ?? []);
    setSubjects(s ?? []);
    // The group cards are ready after the first parallel request. Teacher names
    // can arrive a moment later without holding the whole page on "Loading".
    setLoading(false);
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // A group created anywhere in the app (or another tab) shows up here at once.
  useDataEvent("groups", load);

  const remove = async (id: string) => {
    if (
      !confirm(
        "Guruh o'chirilsinmi? Guruhga biriktirilgan darslar/o'quvchilar avval bo'shatilishi kerak.",
      )
    )
      return;
    const { error } = await supabase.from("groups").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Guruh o'chirildi");
    emitDataChanged("groups");
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
          <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAddingTo(null)} disabled={groups.length === 0}>
            <UserPlus className="h-4 w-4" /> O‘quvchi qo‘shish
          </Button>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Guruh qo'shish
          </button>
          </div>
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
              isTeacher={isTeacher}
              isOpen={expanded === g.id}
              onToggle={() => setExpanded(expanded === g.id ? null : g.id)}
              onAdd={() => setAddingTo(g.id)}
              onEdit={() => setEditing(g)}
              onDelete={() => remove(g.id)}
              teachers={teachers}
            />
          ))}
        </div>
      )}

      {addingTo !== undefined && groups.length > 0 && <GroupStudentDialog groups={groups} initialGroupId={addingTo} onClose={() => setAddingTo(undefined)} onDone={(id) => setExpanded(id)} />}
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
  isTeacher,
  isOpen,
  onToggle,
  onEdit,
  onAdd,
  onDelete,
  teachers,
}: {
  group: Group;
  isStaff: boolean;
  isTeacher: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onAdd: () => void;
  onDelete: () => void;
  teachers: Teacher[];
}) {
  return (
    <div id={`group-${group.id}`} className="rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
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
          ? (teachers.find((t) => t.id === group.teacher_id)?.full_name ?? null)
          : null;
        return (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
              {group.subject?.name ?? "Fan tanlanmagan"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 ${
                teacherName
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-amber-500/10 text-amber-500"
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
        <Users className="h-3.5 w-3.5" /> O'quvchilar{" "}
        {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {isOpen && (
        <GroupRoster
          group={group}
          isStaff={isStaff}
          canGenerateTelegram={isStaff || isTeacher}
          teachers={teachers}
          onAdd={onAdd}
        />
      )}
    </div>
  );
}

function GroupRoster({
  onAdd,
  group,
  isStaff,
  canGenerateTelegram,
  teachers,
}: {
  group: Group;
  isStaff: boolean;
  canGenerateTelegram: boolean;
  onAdd: () => void;
  teachers: Teacher[];
}) {
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("student_enrollments")
      .select("id, student_id, status, student:students(id, first_name, last_name, parent_phone, low_income, low_income_note)")
      .eq("group_id", group.id)
      .in("status", ["active", "trial"])
      .order("started_at", { ascending: false });
    if (error) toast.error(`Guruh tarkibi yuklanmadi: ${error.message}`);
    setRows((data as never) ?? []);
    setLoading(false);
  }, [group.id, group.teacher_id, group.subject_id]);

  useEffect(() => {
    load();
  }, [load]);

  useDataEvent("students", load);

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
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {r.student?.id ? (
                    <Link to="/students/$id" params={{ id: r.student.id }} className="truncate font-semibold hover:text-primary hover:underline">
                      {r.student?.first_name} {r.student?.last_name ?? ""}
                    </Link>
                  ) : (
                    <span className="truncate font-semibold">{r.student?.first_name} {r.student?.last_name ?? ""}</span>
                  )}
                  {r.student?.low_income && (
                    <LowIncomeBadge note={r.student.low_income_note} compact />
                  )}
                </div>
                {r.student?.parent_phone && (
                  <div className="truncate text-muted-foreground">{r.student.parent_phone}</div>
                )}
              </div>
              {canGenerateTelegram && (
                <TelegramIdButton
                  kind="student"
                  id={r.student_id}
                  name={
                    `${r.student?.first_name ?? ""} ${r.student?.last_name ?? ""}`.trim() ||
                    "O'quvchi"
                  }
                  compact
                />
              )}
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

      {canGenerateTelegram && group.teacher_id && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs">
          <span>
            O'qituvchi:{" "}
            {teachers.find((teacher) => teacher.id === group.teacher_id)?.full_name ?? "—"}
          </span>
          <TelegramIdButton
            kind="teacher"
            id={group.teacher_id}
            name={
              teachers.find((teacher) => teacher.id === group.teacher_id)?.full_name ?? "O'qituvchi"
            }
            compact
          />
        </div>
      )}

      {isStaff && <Button size="sm" variant="outline" className="w-full" onClick={onAdd}><UserPlus /> Shu guruhga o‘quvchi qo‘shish</Button>}
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
    schedule_days: initial?.schedule_days ?? [],
    schedule_start: initial?.schedule_start?.slice(0, 5) ?? "",
    schedule_end: initial?.schedule_end?.slice(0, 5) ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [localSubjects, setLocalSubjects] = useState<Subject[]>(subjects);

  // Suggest teachers whose level matches the subject name (loose match).
  const suggestedTeachers = useMemo(() => {
    const subj = localSubjects.find((s) => s.id === form.subject_id)?.name.toLowerCase() ?? "";
    if (!subj) return teachers;
    return [...teachers].sort((a, b) => {
      const aMatch = (a.teacher_level ?? "").toLowerCase().includes(subj) ? -1 : 0;
      const bMatch = (b.teacher_level ?? "").toLowerCase().includes(subj) ? -1 : 0;
      return aMatch - bMatch;
    });
  }, [teachers, localSubjects, form.subject_id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    let weekly;
    try {
      weekly = groupWeekSchedule(form.schedule_days, form.schedule_start, form.schedule_end);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Jadvalni tekshiring');
      setLoading(false);
      return;
    }
    const payload = {
      name: form.name.trim(),
      subject_id: form.subject_id || null,
      teacher_id: form.teacher_id || null,
      monthly_fee: form.monthly_fee,
      ...weekly,
      schedule: weekly.schedule ?? (form.schedule.trim() || null),
    };
    const { error } = initial
      ? await supabase.from("groups").update(payload).eq("id", initial.id).select('id').single()
      : await supabase.from("groups").insert(payload).select('id').single();
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    toast.success(initial ? "Yangilandi" : "Guruh qo'shildi");
    emitDataChanged("groups");
    emitDataChanged("lessons");
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{initial ? "Guruhni tahrirlash" : "Yangi guruh"}</h2>
          <button onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nomi
            </div>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
              placeholder="Ingliz-A1-Ertalab"
            />
          </label>
          <label className="block text-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Fan
              </span>
              <button
                type="button"
                onClick={async () => {
                  const name = prompt("Yangi fan nomi (masalan: Ingliz tili)")?.trim();
                  if (!name) return;
                  const { data, error } = await supabase
                    .from("subjects")
                    .insert({ name })
                    .select("id, name")
                    .single();
                  if (error) return toast.error(error.message);
                  setLocalSubjects((p) =>
                    [...p, data as Subject].sort((a, b) => a.name.localeCompare(b.name)),
                  );
                  setForm((f) => ({ ...f, subject_id: (data as Subject).id }));
                  emitDataChanged("subjects");
                  toast.success("Fan qo'shildi");
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                + Yangi fan
              </button>
            </div>
            <select
              value={form.subject_id}
              onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
            >
              <option value="">— tanlanmagan —</option>
              {localSubjects.map((s) => (
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
                Hali biror foydalanuvchida <b>teacher</b> roli yo'q. Sozlamalar → O'qituvchilar
                bo'limidan yarating.
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
          </div>
          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-semibold">Hafta kunlari</legend>
            <div className="flex flex-wrap gap-3">
              {GROUP_WEEK_DAYS.map((day, index) => <label key={day} className="flex items-center gap-1.5 text-sm">
                <Checkbox checked={form.schedule_days.includes(index + 1)} onCheckedChange={checked => setForm(f => ({ ...f, schedule_days: checked ? [...f.schedule_days, index + 1] : f.schedule_days.filter(d => d !== index + 1) }))} />{day}
              </label>)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">Boshlanish<input type="time" required={form.schedule_days.length > 0} value={form.schedule_start} onChange={e => setForm({ ...form, schedule_start: e.target.value })} className="mt-1 w-full min-w-0 rounded-md border border-border bg-background px-2 py-2" /></label>
              <label className="block text-sm">Tugash<input type="time" required={form.schedule_days.length > 0} value={form.schedule_end} onChange={e => setForm({ ...form, schedule_end: e.target.value })} className="mt-1 w-full min-w-0 rounded-md border border-border bg-background px-2 py-2" /></label>
            </div>
            {initial?.schedule && !initial.schedule_days?.length && <p className="text-xs text-muted-foreground">Avvalgi jadval: {initial.schedule}</p>}
          </fieldset>
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </p>
          )}
          <Button
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "..." : initial ? "Saqlash" : "Qo'shish"}
          </Button>
        </form>
      </div>
    </div>
  );
}
