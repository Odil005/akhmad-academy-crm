import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Eye, EyeOff, BookOpen } from "lucide-react";
import { toast } from "sonner";

type Course = {
  id: string;
  title: string;
  description: string;
  level: string;
  sort_order: number;
  is_visible: boolean;
};

export const Route = createFileRoute("/_authenticated/settings/homepage-courses")({
  component: HomepageCoursesPage,
});

function HomepageCoursesPage() {
  const [rows, setRows] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState({ title: "", description: "", level: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("homepage_courses")
      .select("*")
      .order("sort_order")
      .order("title");
    setRows((data as Course[] | null) ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!adding.title.trim()) return toast.error("Fan nomi kerak");
    const max = rows.reduce((m, r) => Math.max(m, r.sort_order), 0);
    const { error } = await supabase.from("homepage_courses").insert({
      title: adding.title.trim(),
      description: adding.description.trim(),
      level: adding.level.trim(),
      sort_order: max + 10,
    });
    if (error) return toast.error(error.message);
    setAdding({ title: "", description: "", level: "" });
    toast.success("Qo'shildi");
    load();
  };

  const patch = (id: string, patch: Partial<Course>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async (r: Course) => {
    const { error } = await supabase
      .from("homepage_courses")
      .update({
        title: r.title,
        description: r.description,
        level: r.level,
        sort_order: r.sort_order,
        is_visible: r.is_visible,
      })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Saqlandi");
  };

  const remove = async (id: string) => {
    if (!confirm("O'chirilsinmi?")) return;
    const { error } = await supabase.from("homepage_courses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <BookOpen className="h-5 w-5 text-primary" /> Bosh sahifa fanlari (reklama)
        </h2>
        <p className="text-sm text-muted-foreground">
          Bu ro'yxat saytning bosh sahifasidagi "Fanlar" bo'limida ko'rinadi.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Yangi fan qo'shish
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr_120px_auto]">
          <input
            value={adding.title}
            onChange={(e) => setAdding({ ...adding, title: e.target.value })}
            placeholder="Fan nomi"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={adding.description}
            onChange={(e) => setAdding({ ...adding, description: e.target.value })}
            placeholder="Qisqa tavsif"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={adding.level}
            onChange={(e) => setAdding({ ...adding, level: e.target.value })}
            placeholder="Daraja (A1–C1)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={add}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Qo'shish
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Fanlar yo'q
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[80px_1fr_2fr_120px_auto]">
                <input
                  type="number"
                  value={r.sort_order}
                  onChange={(e) => patch(r.id, { sort_order: Number(e.target.value) })}
                  className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
                  title="Tartib"
                />
                <input
                  value={r.title}
                  onChange={(e) => patch(r.id, { title: e.target.value })}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold"
                />
                <input
                  value={r.description}
                  onChange={(e) => patch(r.id, { description: e.target.value })}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <input
                  value={r.level}
                  onChange={(e) => patch(r.id, { level: e.target.value })}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => patch(r.id, { is_visible: !r.is_visible })}
                    className={`grid h-9 w-9 place-items-center rounded-lg border ${
                      r.is_visible
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                        : "border-border bg-muted text-muted-foreground"
                    }`}
                    title={r.is_visible ? "Ko'rinadi" : "Yashirin"}
                  >
                    {r.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => save(r)}
                    className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"
                    title="Saqlash"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(r.id)}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-destructive/40 text-destructive"
                    title="O'chirish"
                  >
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
