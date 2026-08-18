import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type MethodologyResource = {
  id: string;
  subject_name: string;
  level: string;
  title: string;
  author: string | null;
  description: string | null;
  resource_url: string | null;
  sort_order: number;
  is_active: boolean;
};

type Props = {
  /** Faqat shu fanlar bo'yicha ko'rsatish (o'quvchi profili uchun). */
  subjects?: string[];
  /** Direktor/admin/o'qituvchi uchun qo'shish-o'chirish imkoniyati. */
  canEdit?: boolean;
  /** Sarlavhani ko'rsatish. */
  title?: string;
  compact?: boolean;
};

const db = supabase as unknown as { from: (table: string) => any };

export function MethodologyLibrary({
  subjects,
  canEdit = false,
  title = "Metodika kutubxonasi",
  compact = false,
}: Props) {
  const [rows, setRows] = useState<MethodologyResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    subject_name: "",
    level: "",
    title: "",
    author: "",
    description: "",
    resource_url: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db
      .from("methodology_resources")
      .select(
        "id, subject_name, level, title, author, description, resource_url, sort_order, is_active",
      )
      .eq("is_active", true)
      .order("subject_name")
      .order("level")
      .order("sort_order");
    if (error) toast.error("Metodikalarni yuklashda xatolik");
    setRows((data ?? []) as MethodologyResource[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const normalizedFilter = useMemo(
    () => (subjects ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean),
    [subjects],
  );

  const grouped = useMemo(() => {
    const filtered = normalizedFilter.length
      ? rows.filter((r) =>
          normalizedFilter.some(
            (s) =>
              r.subject_name.toLowerCase().includes(s) || s.includes(r.subject_name.toLowerCase()),
          ),
        )
      : rows;
    const map = new Map<string, Map<string, MethodologyResource[]>>();
    for (const row of filtered) {
      const levels = map.get(row.subject_name) ?? new Map<string, MethodologyResource[]>();
      levels.set(row.level, [...(levels.get(row.level) ?? []), row]);
      map.set(row.subject_name, levels);
    }
    return [...map.entries()];
  }, [rows, normalizedFilter]);

  const submit = async () => {
    if (!draft.subject_name.trim() || !draft.level.trim() || !draft.title.trim()) {
      toast.error("Fan, daraja va kitob nomi majburiy");
      return;
    }
    setSaving(true);
    const { error } = await db.from("methodology_resources").insert({
      subject_name: draft.subject_name.trim(),
      level: draft.level.trim(),
      title: draft.title.trim(),
      author: draft.author.trim() || null,
      description: draft.description.trim() || null,
      resource_url: draft.resource_url.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Saqlanmadi: " + error.message);
      return;
    }
    toast.success("Metodika qo'shildi");
    setDraft({ subject_name: "", level: "", title: "", author: "", description: "", resource_url: "" });
    setFormOpen(false);
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await db.from("methodology_resources").update({ is_active: false }).eq("id", id);
    if (error) {
      toast.error("O'chirilmadi");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <BookOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-tight">{title}</h3>
          <p className="text-xs text-muted-foreground">
            Har bir fan va daraja uchun tavsiya etilgan darslik va qo'llanmalar
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Qo'shish
          </button>
        )}
      </header>

      {canEdit && formOpen && (
        <div className="mb-4 grid gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-2">
          {(
            [
              ["subject_name", "Fan (masalan: Ingliz tili)"],
              ["level", "Daraja (masalan: O'rta (B1-B2))"],
              ["title", "Kitob / qo'llanma nomi"],
              ["author", "Muallif / nashriyot"],
              ["resource_url", "Havola (ixtiyoriy)"],
            ] as const
          ).map(([key, placeholder]) => (
            <input
              key={key}
              value={draft[key]}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              placeholder={placeholder}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          ))}
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Metodik izoh: dars rejasi, haftalik hajm..."
            rows={2}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none sm:col-span-2"
          />
          <div className="sm:col-span-2">
            <button
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Saqlash
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
        </div>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Bu fan bo'yicha metodika hali kiritilmagan.
        </p>
      ) : (
        <div className={compact ? "space-y-4" : "grid gap-4 lg:grid-cols-2"}>
          {grouped.map(([subject, levels]) => (
            <div key={subject} className="rounded-xl border border-border/70 p-4">
              <h4 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-primary">
                {subject}
              </h4>
              <div className="space-y-3">
                {[...levels.entries()].map(([level, items]) => (
                  <div key={level}>
                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      {level}
                    </div>
                    <ul className="space-y-2">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-lg bg-muted/50 px-3 py-2 text-sm"
                        >
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold leading-snug">{item.title}</div>
                              {item.author && (
                                <div className="text-xs text-muted-foreground">{item.author}</div>
                              )}
                              {item.description && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            {item.resource_url && (
                              <a
                                href={item.resource_url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-primary"
                                title="Manbani ochish"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => remove(item.id)}
                                className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive"
                                title="Yashirish"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
