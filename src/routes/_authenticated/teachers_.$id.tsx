import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, Phone, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/teachers_/$id")({
  component: TeacherProfile,
  head: () => ({
    meta: [
      { title: "O'qituvchi profili · Akhmad Academy" },
      { name: "description", content: "O'qituvchining guruhlari, o'quvchilari va kelish tarixi." },
      { property: "og:title", content: "O'qituvchi profili · Akhmad Academy" },
      { property: "og:description", content: "O'qituvchi guruhlari, o'quvchilari va kelishlari bir sahifada." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const DAYS = ["", "Du", "Se", "Chor", "Pay", "Ju", "Sha", "Yak"];

type Profile = { full_name: string | null; phone: string | null; teacher_level: string | null; avatar_url: string | null };
type Group = { id: string; name: string; schedule_days: number[]; schedule_start: string | null; schedule_end: string | null; monthly_fee: number };
type Student = { id: string; full_name: string; group_id: string };

function TeacherProfile() {
  const { id } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [checkins, setCheckins] = useState<{ created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, g, c] = await Promise.all([
        supabase.from("profiles").select("full_name, phone, teacher_level, avatar_url").eq("id", id).maybeSingle(),
        supabase.from("groups").select("id, name, schedule_days, schedule_start, schedule_end, monthly_fee").eq("teacher_id", id).order("name"),
        supabase.from("teacher_checkins").select("created_at:checked_in_at").eq("user_id", id).order("checked_in_at", { ascending: false }).limit(10),
      ]);
      const gs = (g.data ?? []) as Group[];
      let st: Student[] = [];
      if (gs.length) {
        const { data } = await supabase
          .from("student_enrollments")
          .select("group_id, students(id, full_name)")
          .in("group_id", gs.map((x) => x.id))
          .eq("status", "active");
        st = (data ?? []).flatMap((r: any) => (r.students ? [{ id: r.students.id, full_name: r.students.full_name, group_id: r.group_id }] : []));
      }
      if (!alive) return;
      setProfile((p.data as Profile) ?? null);
      setGroups(gs);
      setStudents(st);
      setCheckins((c.data as any) ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Yuklanmoqda…</div>;
  if (!profile) return <div className="p-6 text-sm text-muted-foreground">O'qituvchi topilmadi.</div>;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Link to="/teachers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> O'qituvchilar
      </Link>
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-2xl font-bold text-primary">
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (profile.full_name ?? "?").charAt(0)}
        </div>
        <div>
          <h1 className="text-xl font-bold">{profile.full_name ?? "—"}</h1>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5" /> {profile.phone ?? "Telefon yo'q"} · {profile.teacher_level ?? "daraja belgilanmagan"}
          </p>
        </div>
        <div className="ml-auto grid grid-cols-2 gap-3 text-center">
          <Stat label="Guruh" value={groups.length} />
          <Stat label="O'quvchi" value={students.length} />
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Guruhlar va o'quvchilar</h2>
        {groups.length === 0 && <p className="text-sm text-muted-foreground">Guruh biriktirilmagan.</p>}
        <div className="space-y-3">
          {groups.map((g) => {
            const list = students.filter((s) => s.group_id === g.id);
            return (
              <div key={g.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to="/groups" search={{ group: g.id } as any} className="font-medium hover:text-primary">{g.name}</Link>
                  <span className="text-xs text-muted-foreground">
                    {g.schedule_days.map((d) => DAYS[d]).join(", ") || "—"} {g.schedule_start?.slice(0, 5) ?? ""}
                    {g.schedule_end ? `–${g.schedule_end.slice(0, 5)}` : ""} · {list.length} o'quvchi
                  </span>
                </div>
                {list.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {list.map((s) => (
                      <Link key={s.id} to="/students/$id" params={{ id: s.id }} className="rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-primary/15">
                        {s.full_name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><Clock className="h-4 w-4" /> Oxirgi kelishlar</h2>
        {checkins.length === 0 ? (
          <p className="text-sm text-muted-foreground">Hali qayd yo'q.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {checkins.map((c, i) => <li key={i}>{new Date(c.created_at).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
