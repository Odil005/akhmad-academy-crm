import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/subjects")({
  component: SubjectsPage,
});

type Subject = { id: string; name: string; groups: number; students: number };

function SubjectsPage() {
  const [items, setItems] = useState<Subject[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    // Fan bo'yicha guruh va o'quvchi sonini bitta yuklashda hisoblaymiz.
    const [{ data: subs }, { data: groups }, { data: students }] = await Promise.all([
      supabase.from("subjects").select("id, name").order("name"),
      supabase.from("groups").select("id, subject_id"),
      supabase.from("students").select("group_id").eq("status_enum", "active"),
    ]);
    const perGroup = new Map<string, number>();
    (students ?? []).forEach((st) => st.group_id && perGroup.set(st.group_id, (perGroup.get(st.group_id) ?? 0) + 1));
    const gCount = new Map<string, number>();
    const sCount = new Map<string, number>();
    (groups ?? []).forEach((g) => {
      if (!g.subject_id) return;
      gCount.set(g.subject_id, (gCount.get(g.subject_id) ?? 0) + 1);
      sCount.set(g.subject_id, (sCount.get(g.subject_id) ?? 0) + (perGroup.get(g.id) ?? 0));
    });
    setItems((subs ?? []).map((x) => ({ ...x, groups: gCount.get(x.id) ?? 0, students: sCount.get(x.id) ?? 0 })));
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    setBusy(true);
    const { error } = await supabase.from("subjects").insert({ name: v });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setName("");
    toast.success("Fan qo'shildi");
    load();
  };

  const save = async () => {
    if (!editing) return;
    const v = editing.name.trim();
    if (!v) return;
    const { error } = await supabase.from("subjects").update({ name: v }).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Fan o'chirilsinmi? Bog'liq guruh va darslardan avval bo'shatilishi kerak.")) return;
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("O'chirildi");
    load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Yangi fan qo'shish</h2>
        </div>
        <form onSubmit={add} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fan nomi (masalan, SAT)"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
          />
          <button disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            <Plus className="h-4 w-4" /> Qo'shish
          </button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Fanlar guruh va dars jadvalida tanlanadi. SAT hamda Ona tili va Adabiyot allaqachon qo'shilgan.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-bold">Mavjud fanlar ({items.length})</h2>
        <p className="mb-4 text-xs text-muted-foreground">Jami {items.reduce((a, b) => a + b.groups, 0)} guruh · {items.reduce((a, b) => a + b.students, 0)} faol o'quvchi</p>
        <ul className="divide-y divide-border">
          {items.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Fanlar yo'q</li>}
          {items.map((s) => (
            <li key={s.id} className="flex items-center gap-2 py-2.5">
              {editing?.id === s.id ? (
                <>
                  <input
                    autoFocus
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                  <button onClick={save} className="rounded-md border border-border p-1.5 text-emerald-500 hover:border-emerald-500">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setEditing(null)} className="rounded-md border border-border p-1.5 hover:border-primary">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-semibold">{s.name}</span>
                  <span className="rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold text-muted-foreground">{s.groups} guruh</span>
                  <span className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">{s.students} o'quvchi</span>
                  <button onClick={() => setEditing({ id: s.id, name: s.name })} className="rounded-md border border-border p-1.5 hover:border-primary">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(s.id)} className="rounded-md border border-border p-1.5 text-destructive hover:border-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
