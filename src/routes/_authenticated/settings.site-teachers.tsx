import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, UserRound, ArrowUp } from "lucide-react";
import type { SiteTeacher } from "@/lib/site-teachers";

export const Route = createFileRoute("/_authenticated/settings/site-teachers")({
  head: () => ({ meta: [
    { title: "Saytdagi ustozlar | Akhmad CRM" },
    { name: "description", content: "Bosh sahifadagi «Ustozlarimiz» bo'limini boshqarish." },
    { property: "og:title", content: "Saytdagi ustozlar | Akhmad CRM" },
    { property: "og:description", content: "Bosh sahifadagi «Ustozlarimiz» bo'limini boshqarish." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: SiteTeachersPage,
});

const blank = (): SiteTeacher => ({ id: crypto.randomUUID(), name: "", subject: "", qualification: "", experience: "", students: "", photo_url: "" });

function SiteTeachersPage() {
  const [items, setItems] = useState<SiteTeacher[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("settings").select("value").eq("key", "site_teachers").maybeSingle().then(({ data }) => {
      const v = data?.value as { items?: SiteTeacher[] } | null;
      setItems(v?.items ?? []);
    });
  }, []);

  const set = (i: number, patch: Partial<SiteTeacher>) => setItems((arr) => arr.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const save = async () => {
    const clean = items.filter((t) => t.name.trim()).map((t) => ({ ...t, name: t.name.trim(), photo_url: t.photo_url?.trim() || "" }));
    setSaving(true);
    const { error } = await supabase.from("settings").update({ value: { items: clean } as any }).eq("key", "site_teachers");
    setSaving(false);
    if (error) toast.error(error.message);
    else { setItems(clean); toast.success("Saqlandi"); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-1 flex items-center gap-2">
        <UserRound className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Saytdagi ustozlar</h2>
      </div>
      <p className="mb-5 text-xs text-muted-foreground">Bosh sahifadagi «Ustozlarimiz» bo'limida shu tartibda chiqadi. Rasm uchun havola (URL) qo'ying — tik formatdagi rasm yaxshi ko'rinadi.</p>
      <div className="space-y-4">
        {items.map((t, i) => (
          <div key={t.id} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[72px_1fr]">
            <div className="h-24 w-[72px] overflow-hidden rounded-lg bg-muted">
              {t.photo_url ? <img src={t.photo_url} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <In label="Ism familiya" v={t.name} on={(v) => set(i, { name: v })} />
              <In label="Fan" v={t.subject} on={(v) => set(i, { subject: v })} ph="Ingliz tili" />
              <In label="Sertifikat / daraja" v={t.qualification ?? ""} on={(v) => set(i, { qualification: v })} ph="IELTS 8.0" />
              <In label="Tajriba" v={t.experience ?? ""} on={(v) => set(i, { experience: v })} ph="5 yil" />
              <In label="O'quvchilar" v={t.students ?? ""} on={(v) => set(i, { students: v })} ph="500+" />
              <In label="Rasm URL" v={t.photo_url ?? ""} on={(v) => set(i, { photo_url: v })} ph="https://..." />
              <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
                {i > 0 && (
                  <button type="button" onClick={() => setItems((a) => { const b = [...a]; [b[i - 1], b[i]] = [b[i]!, b[i - 1]!]; return b; })} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs"><ArrowUp className="h-3.5 w-3.5" /> Yuqoriga</button>
                )}
                <button type="button" onClick={() => setItems((a) => a.filter((_, j) => j !== i))} className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs text-destructive"><Trash2 className="h-3.5 w-3.5" /> O'chirish</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => setItems((a) => [...a, blank()])} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold"><Plus className="h-4 w-4" /> Ustoz qo'shish</button>
        <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? "..." : "Saqlash"}</button>
      </div>
    </div>
  );
}

function In({ label, v, on, ph }: { label: string; v: string; on: (v: string) => void; ph?: string }) {
  return (
    <label className="block text-sm">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input value={v} placeholder={ph} onChange={(e) => on(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
    </label>
  );
}
