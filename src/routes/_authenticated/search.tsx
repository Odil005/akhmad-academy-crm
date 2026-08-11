import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search as SearchIcon, User, Users, GraduationCap, UserRound, Phone } from "lucide-react";
import { STATUS_META } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/search")({
  component: SearchPage,
});

type StudentRow = any;
type ProfileRow = { id: string; full_name: string | null; phone: string | null };
type GroupRow = any;
type LeadRow = { id: string; name: string | null; phone: string | null; course: string | null; status: string | null };

function SearchPage() {
  const [q, setQ] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Strip PostgREST filter delimiters and SQL wildcards so a crafted
    // string cannot inject extra .or() clauses. Cap length as a safety belt.
    const raw = q.trim().slice(0, 64);
    const query = raw.replace(/[,()%_*"'\\]/g, " ").replace(/\s+/g, " ").trim();
    if (query.length < 2) {
      setStudents([]); setProfiles([]); setGroups([]); setLeads([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const like = `%${query}%`;

      // 1) Profiles (staff/students accounts)
      const profilesQ = supabase
        .from("profiles")
        .select("id, full_name, phone")
        .or(`full_name.ilike.${like},phone.ilike.${like}`)
        .limit(30);

      // 2) Groups
      const groupsQ = supabase
        .from("groups")
        .select("id, name, subject:subjects(name), teacher:profiles!groups_teacher_id_fkey(full_name)")
        .ilike("name", like)
        .limit(20);

      // 3) Leads (site applications)
      const leadsQ = supabase
        .from("leads")
        .select("id, name, phone, course, status")
        .or(`name.ilike.${like},phone.ilike.${like},course.ilike.${like}`)
        .limit(20);

      const [{ data: profs }, { data: grps }, { data: lds }] = await Promise.all([profilesQ, groupsQ, leadsQ]);

      // 4) Students — search by own fields + parent fields + matched profile ids
      const profileIds = (profs ?? []).map((p: any) => p.id);
      const orParts: string[] = [
        `first_name.ilike.${like}`,
        `last_name.ilike.${like}`,
        `parent_full_name.ilike.${like}`,
        `parent_phone.ilike.${like}`,
        `parent_telegram_chat_id.ilike.${like}`,
      ];
      if (profileIds.length) orParts.push(`profile_id.in.(${profileIds.join(",")})`);

      const { data: studs } = await supabase
        .from("students")
        .select(`
          id, status_enum, full_name, first_name, last_name, parent_phone, parent_full_name, parent_telegram_chat_id,
          profile:profiles(full_name, phone),
          group:groups(name, teacher:profiles!groups_teacher_id_fkey(full_name), subject:subjects(name))
        `)
        .or(orParts.join(","))
        .limit(50);

      const rows: any[] = studs ?? [];
      if (rows.length) {
        const ids = rows.map((r) => r.id);
        const { data: pays } = await supabase
          .from("payments")
          .select("student_id, amount, status")
          .in("student_id", ids);
        const debt: Record<string, number> = {};
        (pays ?? []).forEach((p: any) => {
          if (p.status === "pending") debt[p.student_id] = (debt[p.student_id] ?? 0) + Number(p.amount);
        });
        rows.forEach((r) => { r._debt = debt[r.id] ?? 0; });
      }

      setStudents(rows);
      setProfiles(profs ?? []);
      setGroups(grps ?? []);
      setLeads(lds ?? []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const total = students.length + profiles.length + groups.length + leads.length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold md:text-3xl">Global qidiruv</h1>
        <p className="text-sm text-muted-foreground">O'quvchi, foydalanuvchi, guruh, lid — ism, telefon, ota-ona, Telegram bo'yicha</p>
      </header>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Kamida 2 ta belgi kiriting..."
          className="w-full rounded-lg border border-border bg-background py-3 pl-10 pr-3 text-sm"
        />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Qidirilmoqda...</p>}
      {!loading && q.trim().length >= 2 && total === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Hech narsa topilmadi</p>
      )}

      {students.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground"><GraduationCap className="h-4 w-4" /> O'quvchilar ({students.length})</h2>
          <div className="grid gap-3">
            {students.map((r) => {
              const meta = STATUS_META[(r.status_enum ?? "active") as keyof typeof STATUS_META] ?? { label: r.status_enum, bg: "bg-muted" };
              const name = r.full_name?.trim() || `${r.last_name ?? ""} ${r.first_name ?? ""}`.trim() || r.profile?.full_name || "—";
              return (
                <Link key={r.id} to="/students/$id" params={{ id: r.id }} className="block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-bold">{name}</div>
                      <div className="text-xs text-muted-foreground">
                        📞 {r.profile?.phone || "—"} · Ota-ona: {r.parent_full_name || "—"} {r.parent_phone ? `(${r.parent_phone})` : ""}
                        {r.parent_telegram_chat_id ? ` · TG: ${r.parent_telegram_chat_id}` : ""}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold text-white ${meta.bg}`}>{meta.label}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                    <div><span className="text-muted-foreground">Fan:</span> <b>{r.group?.subject?.name || "—"}</b></div>
                    <div><span className="text-muted-foreground">Guruh:</span> <b>{r.group?.name || "—"}</b></div>
                    <div><span className="text-muted-foreground">O'qituvchi:</span> <b>{r.group?.teacher?.full_name || "—"}</b></div>
                    <div><span className="text-muted-foreground">Qarz:</span> <b className={r._debt > 0 ? "text-destructive" : ""}>{Number(r._debt || 0).toLocaleString()} so'm</b></div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {profiles.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground"><User className="h-4 w-4" /> Foydalanuvchilar ({profiles.length})</h2>
          <div className="grid gap-2">
            {profiles.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
                <div><b>{p.full_name || "—"}</b></div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{p.phone || "—"}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {groups.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground"><Users className="h-4 w-4" /> Guruhlar ({groups.length})</h2>
          <div className="grid gap-2">
            {groups.map((g) => (
              <Link key={g.id} to="/groups" className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm hover:border-primary/50">
                <div><b>{g.name}</b> · <span className="text-muted-foreground">{g.subject?.name || "—"}</span></div>
                <div className="text-xs text-muted-foreground">{g.teacher?.full_name || "—"}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {leads.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground"><UserRound className="h-4 w-4" /> Lidlar ({leads.length})</h2>
          <div className="grid gap-2">
            {leads.map((l) => (
              <Link key={l.id} to="/leads" className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm hover:border-primary/50">
                <div><b>{l.name || "—"}</b> · <span className="text-muted-foreground">{l.phone || "—"}</span> · {l.course || "—"}</div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{l.status || "new"}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
