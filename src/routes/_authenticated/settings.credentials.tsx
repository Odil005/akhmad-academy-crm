import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createManagedUser, resetAccessCode, deleteManagedUser, listDirectorLogins } from "@/lib/user-admin.functions";
import { generateUsername, generateAccessCode } from "@/lib/credentials";
import { Copy, RefreshCw, UserPlus, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/credentials")({
  component: CredentialsPage,
});

type Role = "student" | "teacher" | "admin" | "director";

function CredentialsPage() {
  const create = useServerFn(createManagedUser);
  const reset = useServerFn(resetAccessCode);
  const remove = useServerFn(deleteManagedUser);
  const listDirectors = useServerFn(listDirectorLogins);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    role: "student" as Role,
    username: "",
    access_code: "",
    group_id: "",
  });
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Role>("student");
  const [list, setList] = useState<Array<{ id: string; username: string; access_code: string; user_id: string | null; label: string }>>([]);

  useEffect(() => {
    supabase.from("groups").select("id, name").order("name").then(({ data }) => setGroups(data ?? []));
  }, []);

  useEffect(() => {
    (async () => {
      if (tab === "student") {
        const { data } = await supabase
          .from("student_credentials")
          .select("id, username, access_code, auth_user_id, student:students(profile:profiles(full_name))")
          .order("created_at", { ascending: false });
        setList((data ?? []).map((r: any) => ({
          id: r.id, username: r.username, access_code: r.access_code,
          user_id: r.auth_user_id, label: r.student?.profile?.full_name ?? "—",
        })));
      } else if (tab === "teacher") {
        const { data } = await supabase
          .from("teacher_credentials")
          .select("id, username, access_code, teacher_user_id")
          .order("created_at", { ascending: false });
        const ids = (data ?? []).map((r: any) => r.teacher_user_id).filter(Boolean);
        const { data: profs } = ids.length
          ? await supabase.from("profiles").select("id, full_name").in("id", ids)
          : { data: [] as Array<{ id: string; full_name: string | null }> };
        const nameMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
        setList((data ?? []).map((r: any) => ({
          id: r.id, username: r.username, access_code: r.access_code,
          user_id: r.teacher_user_id, label: nameMap.get(r.teacher_user_id) ?? "—",
        })));
      } else if (tab === "director") {
        try {
          const rows = await listDirectors({ data: undefined as never });
          setList(rows.map((r) => ({ ...r, access_code: "***" })));
        } catch {
          setList([]);
        }
      } else {
        const { data } = await supabase
          .from("admin_credentials")
          .select("id, username, access_code, admin_user_id")
          .order("created_at", { ascending: false });
        const ids = (data ?? []).map((r: any) => r.admin_user_id).filter(Boolean);
        const { data: profs } = ids.length
          ? await supabase.from("profiles").select("id, full_name").in("id", ids)
          : { data: [] as Array<{ id: string; full_name: string | null }> };
        const nameMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
        setList((data ?? []).map((r: any) => ({
          id: r.id, username: r.username, access_code: r.access_code,
          user_id: r.admin_user_id, label: nameMap.get(r.admin_user_id) ?? "—",
        })));
      }
    })();
  }, [tab, loading]);

  const regenerate = () => {
    setForm((f) => ({
      ...f,
      username: generateUsername(f.first_name, f.last_name, f.phone),
      access_code: generateAccessCode(8),
    }));
  };

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success("Nusxa olindi");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.username || !form.access_code) {
      toast.error("Ism, username va access_code kerak");
      return;
    }
    setLoading(true);
    try {
      const username = form.username.trim().toLowerCase();
      const plaintextCode = form.access_code;
      const result = await create({
        data: {
          username,
          access_code: plaintextCode,
          full_name: `${form.first_name} ${form.last_name}`.trim(),
          phone: form.phone || null,
          role: form.role,
          group_id: form.role === "student" && form.group_id ? form.group_id : null,
        },
      });
      if (!result.ok) {
        toast.error(result.error ?? "Login saqlanmadi");
        return;
      }
      toast.success("Foydalanuvchi yaratildi");
      window.prompt(
        `Kirish kodi (faqat bir marta ko'rsatiladi — nusxa oling):\nUsername: ${username}`,
        result.access_code ?? plaintextCode,
      );
      setForm({ first_name: "", last_name: "", phone: "", role: form.role, username: "", access_code: "", group_id: "" });
    } catch (err: any) {
      toast.error(err?.message ?? "Xatolik");
    } finally {
      setLoading(false);
    }
  };

  const doReset = async (user_id: string | null, role: Role) => {
    if (!user_id) return;
    const newCode = generateAccessCode(8);
    if (!confirm(`Yangi kod: ${newCode}\nDavom etilsinmi? Kod faqat bir marta ko'rsatiladi.`)) return;
    try {
      const res = await reset({ data: { user_id, new_code: newCode, role } });
      window.prompt("Yangi kirish kodi (nusxa oling — qayta ko'rinmaydi):", res?.access_code ?? newCode);
      toast.success("Kod yangilandi");
      setLoading((l) => !l);
    } catch (e: any) {
      toast.error(e?.message ?? "Xato");
    }
  };

  const doDelete = async (user_id: string | null, role: Role, label: string) => {
    if (!user_id) {
      toast.error("Auth user ID topilmadi");
      return;
    }
    if (!confirm(`"${label}" loginini butunlay o'chirasizmi? Bu amalni qaytarib bo'lmaydi.`)) return;
    try {
      const res = await remove({ data: { user_id, role } });
      if (!res.ok) {
        toast.error(res.error ?? "O'chirilmadi");
        return;
      }
      toast.success("O'chirildi");
      setLoading((l) => !l);
    } catch (e: any) {
      toast.error(e?.message ?? "Xato");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Yangi login yaratish</h2>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Ism" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} />
            <Input label="Familiya" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} />
          </div>
          <Input label="Telefon" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <label className="block text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rol</div>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5">
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin (faqat direktor)</option>
              <option value="director">Director</option>
            </select>
          </label>
          {form.role === "student" && (
            <label className="block text-sm">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Guruh</div>
              <select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5">
                <option value="">— tanlanmagan —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          )}

          <button type="button" onClick={regenerate} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary">
            <RefreshCw className="h-3.5 w-3.5" /> Avto-generatsiya
          </button>

          <div className="grid grid-cols-2 gap-3">
            <FieldWithCopy label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
            <FieldWithCopy label="Access code" value={form.access_code} onChange={(v) => setForm({ ...form, access_code: v })} />
          </div>

          <button disabled={loading} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {loading ? "Yaratilmoqda..." : "Yaratish"}
          </button>
          <p className="text-xs text-muted-foreground">
            Foydalanuvchi bu ma'lumotlarni <b>/auth → "Xodim / O'quvchi"</b> tabiga kiritadi: <b>Foydalanuvchi nomi</b> = <span className="font-mono">{form.username || "username"}</span>, <b>Kirish kodi</b> = access code. Email maydoni bu holatda kerak emas — tizim ichki identifikatorga avtomatik aylantiradi.
          </p>

        </form>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Mavjud loginlar</h2>
        </div>
        <div className="mb-3 flex gap-2">
          {(["student", "teacher", "admin", "director"] as Role[]).map((r) => (
            <button key={r} onClick={() => setTab(r)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === r ? "bg-primary text-primary-foreground" : "border border-border"}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="max-h-[520px] overflow-y-auto divide-y divide-border">
          {list.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Yozuv yo'q</p>}
          {list.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{r.label}</div>
                <div className="truncate text-xs text-muted-foreground">{r.username} · <span className="font-mono opacity-60">kod saqlanmagan</span></div>
              </div>
              <button onClick={() => copy(r.username)} className="rounded-md border border-border p-1.5 hover:border-primary" title="Usernameni nusxalash">
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => doReset(r.user_id, tab)} className="rounded-md border border-border p-1.5 hover:border-primary" title="Reset code">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => doDelete(r.user_id, tab, r.label)} className="rounded-md border border-border p-1.5 text-destructive hover:border-destructive" title="O'chirish">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
    </label>
  );
}
function FieldWithCopy({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex gap-1">
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-xs" />
        <button type="button" onClick={() => { navigator.clipboard.writeText(value); toast.success("Nusxa olindi"); }} className="rounded-lg border border-border px-2 hover:border-primary">
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </label>
  );
}
