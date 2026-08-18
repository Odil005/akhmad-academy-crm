import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Plus, PlayCircle, Trash2, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isAdmin as hasAdminRole, isDirector as hasDirectorRole } from "@/lib/authz";
import { resolveTourRole } from "@/lib/tour-steps";

export const Route = createFileRoute("/_authenticated/guide")({
  component: GuidePage,
  head: () => ({
    meta: [
      { title: "Video qo'llanma — Akhmad Academy CRM" },
      {
        name: "description",
        content:
          "Akhmad Academy CRM bo'yicha rol asosidagi video qo'llanmalar: o'quvchi qo'shish, to'lov, davomat va hisobotlar.",
      },
      { property: "og:title", content: "Video qo'llanma — Akhmad Academy CRM" },
      {
        property: "og:description",
        content: "Administrator, direktor, o'qituvchi va o'quvchi uchun qadamli video darslar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type GuideVideo = {
  id: string;
  title: string;
  description: string | null;
  target_role: string;
  video_url: string | null;
  storage_path: string | null;
  duration_seconds: number | null;
  position: number;
  published: boolean;
};

const ROLE_TABS: Array<{ key: string; label: string }> = [
  { key: "admin", label: "Administrator" },
  { key: "director", label: "Director" },
  { key: "teacher", label: "O'qituvchi" },
  { key: "student", label: "O'quvchi" },
];

function GuidePage() {
  const { user, roles } = Route.useRouteContext();
  const canManage = hasAdminRole(roles) || hasDirectorRole(roles);
  const myRole = resolveTourRole(roles);

  const [tab, setTab] = useState<string>(myRole);
  const [rows, setRows] = useState<GuideVideo[]>([]);
  const [views, setViews] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<GuideVideo | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", url: "", role: myRole });

  const db = supabase as unknown as { from: (table: string) => any };

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: videos, error }, { data: viewRows }] = await Promise.all([
      db
        .from("guide_videos")
        .select(
          "id, title, description, target_role, video_url, storage_path, duration_seconds, position, published",
        )
        .order("target_role")
        .order("position"),
      db.from("guide_video_views").select("video_id").eq("user_id", user.id),
    ]);
    if (error) toast.error(error.message);
    setRows(videos ?? []);
    setViews((viewRows ?? []).map((row: { video_id: string }) => row.video_id));
    setLoading(false);
  }, [db, user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => rows.filter((row) => row.target_role === tab && (row.published || canManage)),
    [canManage, rows, tab],
  );
  const watched = visible.filter((row) => views.includes(row.id)).length;

  const openVideo = async (row: GuideVideo) => {
    setActive(row);
    if (views.includes(row.id)) return;
    setViews((current) => [...current, row.id]);
    await db
      .from("guide_video_views")
      .upsert({ video_id: row.id, user_id: user.id }, { onConflict: "video_id,user_id" });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.url.trim()) return toast.error("Sarlavha va video havolasini kiriting");
    setSaving(true);
    const { error } = await db.from("guide_videos").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      target_role: form.role,
      video_url: form.url.trim(),
      position: rows.filter((row) => row.target_role === form.role).length + 1,
      published: true,
      created_by: user.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Video qo'llanma qo'shildi");
    setForm({ title: "", description: "", url: "", role: form.role });
    setFormOpen(false);
    await load();
  };

  const remove = async (row: GuideVideo) => {
    if (!confirm("Video qo'llanma o'chirilsinmi?")) return;
    const { error } = await db.from("guide_videos").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    setRows((items) => items.filter((item) => item.id !== row.id));
    toast.success("O'chirildi");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Video qo'llanma</h1>
          <p className="text-sm text-muted-foreground">
            Har bir rol uchun qadamli video darslar. Ko'rgan videolaringiz avtomatik belgilanadi.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setFormOpen((value) => !value)}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Video qo'shish
          </button>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {ROLE_TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              tab === item.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {item.label}
          </button>
        ))}
        <div className="ml-auto self-center text-xs font-semibold text-muted-foreground">
          {visible.length} dan {watched} tasi ko'rilgan
        </div>
      </div>

      {canManage && formOpen && (
        <form onSubmit={save} className="grid gap-3 rounded-2xl border border-border bg-card p-5 md:grid-cols-2">
          <label className="text-sm">
            Sarlavha
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              placeholder="O'quvchi qo'shish"
            />
          </label>
          <label className="text-sm">
            Rol
            <select
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              {ROLE_TABS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            Video havolasi (MP4 yoki YouTube)
            <input
              value={form.url}
              onChange={(event) => setForm({ ...form, url: event.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              placeholder="https://..."
            />
          </label>
          <label className="text-sm md:col-span-2">
            Tavsif
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <button
            disabled={saving}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Saqlash
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          <Video className="mx-auto mb-3 h-8 w-8 opacity-50" />
          Bu rol uchun hozircha video qo'llanma qo'shilmagan.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((row, index) => {
            const seen = views.includes(row.id);
            return (
              <article
                key={row.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
              >
                <button
                  onClick={() => void openVideo(row)}
                  className="group relative flex aspect-video items-center justify-center bg-secondary"
                >
                  <PlayCircle className="h-14 w-14 text-primary transition group-hover:scale-110" />
                </button>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    <h2 className="flex-1 font-bold leading-snug">{row.title}</h2>
                    {canManage && (
                      <button
                        onClick={() => void remove(row)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
                        title="O'chirish"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {row.description && (
                    <p className="text-xs text-muted-foreground">{row.description}</p>
                  )}
                  <div className="mt-auto text-xs font-semibold">
                    {seen ? (
                      <span className="inline-flex items-center gap-1 text-emerald-500">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Ko'rilgan
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Ko'rilmagan</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {active && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/70" onClick={() => setActive(null)} />
          <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <h3 className="font-bold">{active.title}</h3>
              <button
                onClick={() => setActive(null)}
                className="ml-auto rounded-lg border border-border px-3 py-1 text-sm hover:bg-muted"
              >
                Yopish
              </button>
            </div>
            {active.video_url?.includes("youtu") ? (
              <iframe
                title={active.title}
                src={toEmbed(active.video_url)}
                allowFullScreen
                className="aspect-video w-full"
              />
            ) : (
              <video controls autoPlay preload="metadata" className="aspect-video w-full bg-black" src={active.video_url ?? undefined} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function toEmbed(url: string): string {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
}
