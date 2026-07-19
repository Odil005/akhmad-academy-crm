import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Inbox, Phone, Trash2, CheckCircle2, XCircle, User } from "lucide-react";
import { toast } from "sonner";

type Lead = {
  id: string;
  name: string;
  phone: string;
  course: string | null;
  note: string | null;
  source: string | null;
  status: string;
  created_at: string;
};

const STATUSES = [
  { key: "new", label: "Yangi" },
  { key: "contacted", label: "Bog'lanildi" },
  { key: "converted", label: "O'quvchi bo'ldi" },
  { key: "rejected", label: "Rad etildi" },
];

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

function LeadsPage() {
  const { roles } = Route.useRouteContext();
  const isAdmin = roles.includes("admin");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("id, name, phone, course, note, source, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setLeads((data as Lead[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">Bu bo'lim faqat admin uchun.</p>;
  }

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    toast.success("Yangilandi");
  };

  const remove = async (id: string) => {
    if (!confirm("O'chirilsinmi?")) return;
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setLeads((prev) => prev.filter((l) => l.id !== id));
    toast.success("O'chirildi");
  };

  const filtered = filter === "all" ? leads : leads.filter((l) => l.status === filter);
  const countByStatus = (s: string) => leads.filter((l) => l.status === s).length;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Lidlar (Arizalar)</h1>
          <p className="text-sm text-muted-foreground">Saytdan qoldirilgan arizalar</p>
        </div>
        <div className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          {countByStatus("new")} yangi
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={`Barchasi (${leads.length})`} />
        {STATUSES.map((s) => (
          <FilterChip key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)} label={`${s.label} (${countByStatus(s.key)})`} />
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Ariza yo'q</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((l) => (
            <div key={l.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{l.name}</div>
                      <div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("uz-UZ")}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 font-semibold hover:border-primary">
                      <Phone className="h-3.5 w-3.5" /> {l.phone}
                    </a>
                    {l.course && <span className="rounded-lg bg-muted px-2.5 py-1.5">{l.course}</span>}
                    <StatusBadge status={l.status} />
                  </div>
                  {l.note && <p className="mt-2 text-sm text-muted-foreground">{l.note}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <select
                    value={l.status}
                    onChange={(e) => setStatus(l.id, e.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                  {l.status !== "converted" && (
                    <button onClick={() => setStatus(l.id, "converted")} className="rounded-lg border border-emerald-500/40 p-1.5 text-emerald-500 hover:bg-emerald-500/10" title="O'quvchi bo'ldi">
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  )}
                  {l.status !== "rejected" && (
                    <button onClick={() => setStatus(l.id, "rejected")} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive" title="Rad etish">
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => remove(l.id)} className="rounded-lg border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50"}`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: "bg-primary/15 text-primary",
    contacted: "bg-sky-500/15 text-sky-500",
    converted: "bg-emerald-500/15 text-emerald-500",
    rejected: "bg-muted text-muted-foreground",
  };
  const label = STATUSES.find((s) => s.key === status)?.label ?? status;
  return <span className={`rounded-lg px-2.5 py-1.5 font-semibold ${map[status] ?? "bg-muted"}`}>{label}</span>;
}
