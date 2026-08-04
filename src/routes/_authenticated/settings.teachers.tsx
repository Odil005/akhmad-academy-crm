import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/teachers")({
  component: TeachersPage,
});

type Level = "junior" | "middle" | "senior" | "lead";
type Row = { user_id: string; full_name: string; phone: string | null; teacher_level: Level | null; username: string | null };

const LEVELS: { value: Level; label: string; hint: string; color: string }[] = [
  { value: "junior", label: "Junior", hint: "Yangi boshlovchi o'qituvchi", color: "bg-sky-500/10 text-sky-500" },
  { value: "middle", label: "Middle", hint: "Tajribali o'qituvchi", color: "bg-emerald-500/10 text-emerald-500" },
  { value: "senior", label: "Senior", hint: "Kuchli o'qituvchi", color: "bg-amber-500/10 text-amber-500" },
  { value: "lead", label: "Lead", hint: "Yetakchi / mentor", color: "bg-primary/10 text-primary" },
];

function TeachersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
    const ids = (roles ?? []).map((r: any) => r.user_id).filter(Boolean);
    if (!ids.length) { setRows([]); setLoading(false); return; }
    const [{ data: profs }, { data: creds }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, teacher_level").in("id", ids),
      supabase.from("teacher_credentials").select("teacher_user_id, username").in("teacher_user_id", ids),
    ]);
    const uMap = new Map((creds ?? []).map((c: any) => [c.teacher_user_id, c.username as string]));
    const out: Row[] = (profs ?? []).map((p: any) => ({
      user_id: p.id,
      full_name: p.full_name ?? "—",
      phone: p.phone,
      teacher_level: p.teacher_level ?? null,
      username: uMap.get(p.id) ?? null,
    })).sort((a, b) => a.full_name.localeCompare(b.full_name));
    setRows(out);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setLevel = async (user_id: string, level: Level | null) => {
    const { error } = await supabase.from("profiles").update({ teacher_level: level }).eq("id", user_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Daraja yangilandi");
    setRows((rs) => rs.map((r) => r.user_id === user_id ? { ...r, teacher_level: level } : r));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">O'qituvchilar darajasi</h2>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <span key={l.value} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${l.color}`}>
              {l.label} · <span className="opacity-70">{l.hint}</span>
            </span>
          ))}
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Yuklanmoqda...</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            O'qituvchi topilmadi. Sozlamalar → Login generator orqali yangi o'qituvchi yarating.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Ism</th>
                  <th className="py-2 pr-3">Telefon</th>
                  <th className="py-2 pr-3">Username</th>
                  <th className="py-2 pr-3">Daraja</th>
                  <th className="py-2 pr-3">Telegram</th>

                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.user_id}>
                    <td className="py-2.5 pr-3 font-semibold">{r.full_name}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{r.phone ?? "—"}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{r.username ?? "—"}</td>
                    <td className="py-2.5 pr-3">
                      <select
                        value={r.teacher_level ?? ""}
                        onChange={(e) => setLevel(r.user_id, (e.target.value || null) as Level | null)}
                        className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold"
                      >
                        <option value="">— belgilanmagan —</option>
                        {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </td>
                    <td className="py-2.5 pr-3">
                      <TelegramIdButton kind="teacher" id={r.user_id} name={r.full_name ?? "O'qituvchi"} compact />
                    </td>
                  </tr>

                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
