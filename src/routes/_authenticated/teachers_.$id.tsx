import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, HeartHandshake, Phone, Users, Wallet } from "lucide-react";
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
type Student = { id: string; full_name: string; group_id: string; low_income: boolean };

function TeacherProfile() {
  const { id } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, g] = await Promise.all([
        supabase.from("profiles").select("full_name, phone, teacher_level, avatar_url").eq("id", id).maybeSingle(),
        supabase.from("groups").select("id, name, schedule_days, schedule_start, schedule_end, monthly_fee").eq("teacher_id", id).order("name"),
      ]);
      const gs = (g.data ?? []) as Group[];
      let st: Student[] = [];
      if (gs.length) {
        const { data } = await supabase
          .from("student_enrollments")
          .select("group_id, students(id, full_name, first_name, last_name, low_income)")
          .in("group_id", gs.map((x) => x.id))
          .eq("status", "active");
        st = (data ?? []).flatMap((r: any) => (r.students ? [{
          id: r.students.id,
          full_name: r.students.full_name || [r.students.first_name, r.students.last_name].filter(Boolean).join(" ") || "—",
          group_id: r.group_id,
          low_income: !!r.students.low_income,
        }] : [])).sort((a, b) => a.full_name.localeCompare(b.full_name));
      }
      if (!alive) return;
      setProfile((p.data as Profile) ?? null);
      setGroups(gs);
      setStudents(st);
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
        <div className="ml-auto grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <Stat label="Guruh" value={groups.length} />
          <Stat label="O'quvchi" value={students.length} />
          <Stat label="Pullik" value={students.filter((s) => !s.low_income).length} />
          <Stat label="Reyestr" value={students.filter((s) => s.low_income).length} />
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
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <StudentList
                    title="Pullik o'quvchilar"
                    icon={<Wallet className="h-3.5 w-3.5" />}
                    items={list.filter((s) => !s.low_income)}
                    empty="Pullik o'quvchi yo'q"
                  />
                  <StudentList
                    title="Kambag'al oila reyestri"
                    icon={<HeartHandshake className="h-3.5 w-3.5" />}
                    items={list.filter((s) => s.low_income)}
                    empty="Reyestrdagi o'quvchi yo'q"
                  />
                </div>
              </div>
            );
          })}
        </div>
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

function StudentList({ title, icon, items, empty }: { title: string; icon: ReactNode; items: Student[]; empty: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span className="flex items-center gap-1.5">{icon} {title}</span>
        <span>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-1 py-1 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ol className="space-y-0.5 text-sm">
          {items.map((s, i) => (
            <li key={s.id}>
              <Link to="/students/$id" params={{ id: s.id }} className="flex gap-2 rounded px-1 py-0.5 hover:bg-primary/10 hover:text-primary">
                <span className="w-5 text-xs text-muted-foreground">{i + 1}.</span>
                <span className="truncate">{s.full_name}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
