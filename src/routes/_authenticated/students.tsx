import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, X, RefreshCw, Copy } from "lucide-react";
import { toast } from "sonner";
import { createManagedUser } from "@/lib/user-admin.functions";
import { generateUsername, generateAccessCode } from "@/lib/credentials";

import { z } from "zod";
import { STATUS_META, STATUS_ORDER, type StudentStatus } from "@/lib/status";

type Student = {
  id: string;
  status_enum: StudentStatus | null;
  enrolled_at: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  parent_full_name: string | null;
  parent_phone: string | null;
  parent_telegram_chat_id: string | null;
  parent_notifications_enabled: boolean;
  profile: { full_name: string | null; phone: string | null } | null;
  group: { id: string; name: string } | null;
};

type Group = { id: string; name: string };

const SearchSchema = z.object({
  status: z.enum(["trial", "active", "frozen", "archived", "left"]).optional(),
});

export const Route = createFileRoute("/_authenticated/students")({
  validateSearch: SearchSchema,
  component: StudentsPage,
});

/** O'quvchi ismi: o'z maydonlari birinchi, profil faqat zaxira. */
const displayName = (s: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  profile?: { full_name?: string | null } | null;
}) =>
  s.full_name?.trim() ||
  [s.last_name, s.first_name].filter(Boolean).join(" ").trim() ||
  s.profile?.full_name?.trim() ||
  "Ismsiz o'quvchi";

const PAGE_SIZES = [25, 50, 100];
const STUDENT_COLUMNS = `
  id, status_enum, enrolled_at, full_name, first_name, last_name, parent_full_name, parent_phone, parent_telegram_chat_id, parent_notifications_enabled,
  profile:profiles(full_name, phone),
  group:groups(id, name)
`;

function StudentsPage() {
  const { status: statusFilter } = Route.useSearch();
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // 400 ms debounce — filtering happens on the server, not in the browser.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, pageSize]);

  /** Server-side page load: only the visible rows are fetched. */
  const load = useCallback(async () => {
    setLoading(true);
    const controller = new AbortController();
    let q = supabase
      .from("students")
      .select(STUDENT_COLUMNS, { count: "exact" })
      .order("enrolled_at", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1)
      .abortSignal(controller.signal);
    if (statusFilter) q = q.eq("status_enum", statusFilter);
    if (search) {
      const like = `%${search}%`;
      q = q.or(
        `first_name.ilike.${like},last_name.ilike.${like},full_name.ilike.${like},parent_full_name.ilike.${like},parent_phone.ilike.${like}`,
      );
    }
    const { data: s, count } = await q;
    setStudents((s as never) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
    return () => controller.abort();
  }, [page, pageSize, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    supabase
      .from("groups")
      .select("id, name")
      .order("name")
      .then(({ data }) => setGroups(data ?? []));
  }, []);

  const filtered = students;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const remove = async (id: string) => {
    if (!confirm("O'chirilsinmi?")) return;
    await supabase.from("students").delete().eq("id", id);
    // Faqat o'chirilgan qatorni cache'dan olib tashlaymiz — to'liq qayta yuklash yo'q.
    setStudents((prev) => prev.filter((s) => s.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  };

  const changeStatus = async (s: Student, newStatus: StudentStatus) => {
    const prevStatus = s.status_enum;
    // Optimistik: faqat o'zgargan qator yangilanadi.
    setStudents((prev) => prev.map((r) => (r.id === s.id ? { ...r, status_enum: newStatus } : r)));
    const { error } = await supabase
      .from("students")
      .update({ status_enum: newStatus })
      .eq("id", s.id);
    if (error) {
      setStudents((prev) =>
        prev.map((r) => (r.id === s.id ? { ...r, status_enum: prevStatus } : r)),
      );
      toast.error(error.message);
      return;
    }
    await supabase.from("student_status_history").insert({
      student_id: s.id,
      from_status: prevStatus ?? undefined,
      to_status: newStatus,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">O'quvchilar</h1>
          <p className="text-sm text-muted-foreground">
            {statusFilter
              ? `Filtr: ${STATUS_META[statusFilter as StudentStatus].label}`
              : "Barcha o'quvchilar"}{" "}
            · {total} ta
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Qo'shish
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Ism, ota-ona yoki telefon bo'yicha qidirish..."
          className="min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} / sahifa
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          to="/students"
          search={{}}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!statusFilter ? "bg-primary text-primary-foreground" : "border border-border"}`}
        >
          Barchasi
        </Link>
        {STATUS_ORDER.map((k) => (
          <Link
            key={k}
            to="/students"
            search={{ status: k }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusFilter === k ? `${STATUS_META[k].bg} text-white` : "border border-border"}`}
          >
            {STATUS_META[k].label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Ism</th>
                <th className="px-4 py-3">Telefon</th>
                <th className="px-4 py-3">Ota-ona</th>
                <th className="px-4 py-3">Guruh</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    Yuklanmoqda...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    Yozuv yo'q
                  </td>
                </tr>
              )}
              {filtered.map((s) => {
                const status = (s.status_enum ?? "active") as StudentStatus;
                const meta = STATUS_META[status];
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium">
                      <Link
                        to="/students/$id"
                        params={{ id: s.id }}
                        className="text-primary hover:underline"
                      >
                        {displayName(s)}
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">
                      {s.profile?.phone || s.parent_phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.parent_full_name || "—"}
                      <br />
                      <span className="text-xs">{s.parent_phone || ""}</span>
                    </td>
                    <td className="px-4 py-3">
                      {s.group?.name || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={status}
                        onChange={(e) => changeStatus(s, e.target.value as StudentStatus)}
                        className={`rounded-full border-transparent px-2 py-1 text-xs font-semibold ${meta.tint}`}
                      >
                        {STATUS_ORDER.map((k) => (
                          <option key={k} value={k}>
                            {STATUS_META[k].label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => remove(s.id)}
                        className="text-destructive hover:opacity-70"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <TeachersTable />



      {open && (
        <NewStudentModal
          groups={groups}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

type NewRole = "student" | "teacher";

function NewStudentModal({
  groups,
  onClose,
  onDone,
}: {
  groups: Group[];
  onClose: () => void;
  onDone: () => void;
}) {
  const create = useServerFn(createManagedUser);
  const [role, setRole] = useState<NewRole>("student");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    group_id: groups[0]?.id ?? "",
    parent_full_name: "",
    parent_phone: "",
    parent_telegram_chat_id: "",
    status_enum: "trial" as StudentStatus,
    username: "",
    access_code: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ username: string; access_code: string } | null>(null);

  const regenerate = () => {
    setForm((f) => ({
      ...f,
      username: generateUsername(f.first_name, f.last_name, f.phone),
      access_code: generateAccessCode(8),
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const full_name = `${form.first_name} ${form.last_name}`.trim();
    const username = (
      form.username || generateUsername(form.first_name, form.last_name, form.phone)
    )
      .trim()
      .toLowerCase();
    const access_code = form.access_code || generateAccessCode(8);
    try {
      const res = await create({
        data: {
          username,
          access_code,
          full_name,
          phone: form.phone || null,
          role,
          group_id: role === "student" && form.group_id ? form.group_id : null,
          status_enum: role === "student" ? form.status_enum : null,
          parent_full_name: role === "student" ? form.parent_full_name || null : null,
          parent_phone: role === "student" ? form.parent_phone || null : null,
          parent_telegram_chat_id: role === "student" ? form.parent_telegram_chat_id || null : null,
        },
      });
      if (!res.ok) {
        setError(res.error ?? "Saqlanmadi");
        setLoading(false);
        return;
      }
      setCreated({ username, access_code: res.access_code ?? access_code });
      toast.success(role === "student" ? "O'quvchi yaratildi" : "O'qituvchi yaratildi");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {role === "student" ? "Yangi o'quvchi" : "Yangi o'qituvchi"}
          </h2>
          <button onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {created ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Login ma'lumotlari faqat bir marta ko'rsatiladi — nusxa oling.
            </p>
            <CopyRow label="Foydalanuvchi nomi" value={created.username} />
            <CopyRow label="Kirish kodi" value={created.access_code} />
            <button
              onClick={onDone}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Yopish
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="flex gap-2">
              {(["student", "teacher"] as NewRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${role === r ? "bg-primary text-primary-foreground" : "border border-border"}`}
                >
                  {r === "student" ? "O'quvchi" : "O'qituvchi"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Ism"
                value={form.first_name}
                onChange={(v) => setForm({ ...form, first_name: v })}
                required
              />
              <Field
                label="Familiya"
                value={form.last_name}
                onChange={(v) => setForm({ ...form, last_name: v })}
              />
            </div>
            <Field
              label="Telefon"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
            />

            {role === "student" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Guruh
                    </div>
                    <select
                      value={form.group_id}
                      onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
                    >
                      <option value="">—</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Status
                    </div>
                    <select
                      value={form.status_enum}
                      onChange={(e) =>
                        setForm({ ...form, status_enum: e.target.value as StudentStatus })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
                    >
                      {STATUS_ORDER.map((k) => (
                        <option key={k} value={k}>
                          {STATUS_META[k].label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="rounded-lg border border-border bg-background/50 p-3">
                  <div className="mb-2 text-xs font-bold uppercase text-muted-foreground">
                    Ota-ona ma'lumotlari
                  </div>
                  <div className="space-y-2">
                    <Field
                      label="F.I.O"
                      value={form.parent_full_name}
                      onChange={(v) => setForm({ ...form, parent_full_name: v })}
                    />
                    <Field
                      label="Telefon"
                      value={form.parent_phone}
                      onChange={(v) => setForm({ ...form, parent_phone: v })}
                    />
                    <Field
                      label="Telegram chat ID"
                      value={form.parent_telegram_chat_id}
                      onChange={(v) => setForm({ ...form, parent_telegram_chat_id: v })}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="rounded-lg border border-border bg-background/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-bold uppercase text-muted-foreground">
                  Login generator
                </div>
                <button
                  type="button"
                  onClick={regenerate}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:border-primary"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Avto-generatsiya
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Username"
                  value={form.username}
                  onChange={(v) => setForm({ ...form, username: v })}
                />
                <Field
                  label="Kirish kodi"
                  value={form.access_code}
                  onChange={(v) => setForm({ ...form, access_code: v })}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Bo'sh qoldirsangiz avtomatik yaratiladi.
              </p>
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
              {loading ? "..." : "Saqlash"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate font-mono text-sm">{value}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success("Nusxa olindi");
          }}
          className="rounded-md border border-border p-1.5 hover:border-primary"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
      />
    </label>
  );
}
