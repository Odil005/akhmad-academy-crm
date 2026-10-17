import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Search as SearchIcon,
  User,
  Users,
  GraduationCap,
  UserRound,
  Phone,
  Loader2,
} from "lucide-react";
import { STATUS_META } from "@/lib/status";

type StudentRow = any;
type ProfileRow = { id: string; full_name: string | null; phone: string | null };
type GroupRow = any;
type LeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  course: string | null;
  status: string | null;
};

/**
 * Yagona global qidiruv — yuqori panelda turadi va butun tizim bo'ylab
 * (o'quvchi, foydalanuvchi, guruh, lid) qidiradi.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    // Strip PostgREST filter delimiters and SQL wildcards so a crafted
    // string cannot inject extra .or() clauses. Cap length as a safety belt.
    const raw = q.trim().slice(0, 64);
    const query = raw.replace(/[,()%_*"'\\]/g, " ").replace(/\s+/g, " ").trim();
    if (query.length < 2) {
      setStudents([]);
      setProfiles([]);
      setGroups([]);
      setLeads([]);
      setLoading(false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const like = `%${query}%`;

      const profilesQ = supabase
        .from("profiles")
        .select("id, full_name, phone")
        .or(`full_name.ilike.${like},phone.ilike.${like}`)
        .limit(10);

      const groupsQ = supabase
        .from("groups")
        .select("id, name, teacher_id, subject:subjects(name)")
        .ilike("name", like)
        .limit(8);

      const leadsQ = supabase
        .from("leads")
        .select("id, name, phone, course, status")
        .or(`name.ilike.${like},phone.ilike.${like},course.ilike.${like}`)
        .limit(8);

      const [{ data: profs }, { data: grps }, { data: lds }] = await Promise.all([
        profilesQ,
        groupsQ,
        leadsQ,
      ]);

      // groups.teacher_id auth.users ga qaraydi — PostgREST orqali profiles ga
      // to'g'ridan-to'g'ri bog'lab bo'lmaydi, shuning uchun ismlarni alohida olamiz.
      const teacherIds = [...new Set((grps ?? []).map((g: any) => g.teacher_id).filter(Boolean))];
      const teacherNames = new Map<string, string>();
      if (teacherIds.length) {
        const { data: tprofs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", teacherIds);
        (tprofs ?? []).forEach((p: any) => teacherNames.set(p.id, p.full_name ?? ""));
      }
      (grps ?? []).forEach((g: any) => {
        g.teacher = { full_name: teacherNames.get(g.teacher_id) ?? null };
      });

      const profileIds = (profs ?? []).map((p: any) => p.id);
      const orParts: string[] = [
        `first_name.ilike.${like}`,
        `last_name.ilike.${like}`,
        `full_name.ilike.${like}`,
        `parent_full_name.ilike.${like}`,
        `parent_phone.ilike.${like}`,
        `parent_telegram_chat_id.ilike.${like}`,
      ];
      if (profileIds.length) orParts.push(`profile_id.in.(${profileIds.join(",")})`);

      const { data: studs } = await supabase
        .from("students")
        .select(
          `id, status_enum, full_name, first_name, last_name, parent_phone, parent_full_name,
           profile:profiles(full_name, phone),
           group:groups(name, subject:subjects(name))`,
        )
        .or(orParts.join(","))
        .limit(12);

      setStudents(studs ?? []);
      setProfiles(profs ?? []);
      setGroups(grps ?? []);
      setLeads(lds ?? []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const total = students.length + profiles.length + groups.length + leads.length;
  const showDrop = open && q.trim().length >= 2;

  const close = () => {
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={boxRef} className="relative min-w-0 w-full max-w-md" data-tour="topbar-search">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          if (e.key === "Enter" && students[0]) {
            close();
            navigate({ to: "/students/$id", params: { id: students[0].id } });
          }
        }}
        placeholder="Tizim bo‘ylab qidirish…"
        className="w-full rounded-lg border border-border bg-secondary/60 py-2 pl-9 pr-8 text-xs outline-none transition focus:border-accent"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}

      {showDrop && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-2xl">
          {!loading && total === 0 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Hech narsa topilmadi
            </p>
          )}

          {students.length > 0 && (
            <section>
              <h3 className="flex items-center gap-1.5 px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <GraduationCap className="h-3 w-3" /> O'quvchilar
              </h3>
              {students.map((r) => {
                const meta =
                  STATUS_META[(r.status_enum ?? "active") as keyof typeof STATUS_META] ?? {
                    label: r.status_enum,
                    bg: "bg-muted",
                  };
                const name =
                  r.full_name?.trim() ||
                  `${r.last_name ?? ""} ${r.first_name ?? ""}`.trim() ||
                  r.profile?.full_name ||
                  "—";
                return (
                  <Link
                    key={r.id}
                    to="/students/$id"
                    params={{ id: r.id }}
                    onClick={close}
                    className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-secondary"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold">{name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {r.profile?.phone || r.parent_phone || "telefon yo'q"} ·{" "}
                        {r.group?.name || "guruhsiz"}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${meta.bg}`}
                    >
                      {meta.label}
                    </span>
                  </Link>
                );
              })}
            </section>
          )}

          {profiles.length > 0 && (
            <section>
              <h3 className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <User className="h-3 w-3" /> Foydalanuvchilar
              </h3>
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs"
                >
                  <b className="truncate">{p.full_name || "—"}</b>
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {p.phone || "—"}
                  </span>
                </div>
              ))}
            </section>
          )}

          {groups.length > 0 && (
            <section>
              <h3 className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Users className="h-3 w-3" /> Guruhlar
              </h3>
              {groups.map((g) => (
                <Link
                  key={g.id}
                  to="/groups"
                  onClick={close}
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs transition hover:bg-secondary"
                >
                  <span className="min-w-0 truncate">
                    <b>{g.name}</b> ·{" "}
                    <span className="text-muted-foreground">{g.subject?.name || "—"}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {g.teacher?.full_name || "—"}
                  </span>
                </Link>
              ))}
            </section>
          )}

          {leads.length > 0 && (
            <section>
              <h3 className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <UserRound className="h-3 w-3" /> Lidlar
              </h3>
              {leads.map((l) => (
                <Link
                  key={l.id}
                  to="/leads"
                  onClick={close}
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs transition hover:bg-secondary"
                >
                  <span className="min-w-0 truncate">
                    <b>{l.name || "—"}</b> ·{" "}
                    <span className="text-muted-foreground">{l.phone || "—"}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px]">
                    {l.status || "new"}
                  </span>
                </Link>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
