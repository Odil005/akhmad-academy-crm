import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { FileVideo, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/video-lessons")({ component: VideoLessonsPage });
type VideoRow = { id: string; group_id: string; title: string; description: string | null; storage_path: string; published: boolean; created_at: string; group?: { name: string } | null; url?: string };
type Group = { id: string; name: string };

function VideoLessonsPage() {
  const { user, roles } = Route.useRouteContext();
  const isTeacher = roles.includes("teacher");
  const isStaff = roles.includes("admin") || roles.includes("director");
  const [rows, setRows] = useState<VideoRow[]>([]); const [groups, setGroups] = useState<Group[]>([]); const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [groupId, setGroupId] = useState(""); const [file, setFile] = useState<File | null>(null); const [saving, setSaving] = useState(false);
  const db = supabase as any;
  const load = useCallback(async () => {
    setLoading(true);
    const q = db.from("video_lessons").select("id, group_id, title, description, storage_path, published, created_at, group:groups(name)").order("created_at", { ascending: false });
    const { data, error } = isTeacher && !isStaff ? await q.eq("teacher_user_id", user.id) : await q;
    if (error) { toast.error(error.message); setLoading(false); return; }
    const videos: VideoRow[] = data ?? [];
    const withUrls = await Promise.all(videos.map(async (video) => {
      const { data: signed } = await db.storage.from("course-videos").createSignedUrl(video.storage_path, 3600);
      return { ...video, url: signed?.signedUrl };
    }));
    setRows(withUrls); setLoading(false);
  }, [db, isStaff, isTeacher, user.id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!isTeacher) return; db.from("groups").select("id, name").eq("teacher_id", user.id).order("name").then(({ data }: any) => { setGroups(data ?? []); setGroupId(data?.[0]?.id ?? ""); }); }, [db, isTeacher, user.id]);
  const upload = async (event: React.FormEvent) => { event.preventDefault(); if (!file || !groupId) return toast.error("Guruh va video faylini tanlang"); if (!file.type.startsWith("video/")) return toast.error("Faqat video fayl yuklang"); if (file.size > 500 * 1024 * 1024) return toast.error("Video 500 MB dan kichik bo'lishi kerak"); setSaving(true); const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`; const { error: uploadError } = await db.storage.from("course-videos").upload(path, file, { contentType: file.type }); if (uploadError) { setSaving(false); return toast.error(uploadError.message); } const { error } = await db.from("video_lessons").insert({ group_id: groupId, teacher_user_id: user.id, title: title.trim(), description: description.trim() || null, storage_path: path, published: true }); if (error) { await db.storage.from("course-videos").remove([path]); toast.error(error.message); } else { toast.success("Video dars joylandi"); setTitle(""); setDescription(""); setFile(null); const el = document.getElementById("video-file") as HTMLInputElement | null; if (el) el.value = ""; await load(); } setSaving(false); };
  const remove = async (row: VideoRow) => { if (!confirm("Video dars o'chirilsinmi?")) return; const { error } = await db.from("video_lessons").delete().eq("id", row.id); if (error) return toast.error(error.message); await db.storage.from("course-videos").remove([row.storage_path]); setRows((items) => items.filter((item) => item.id !== row.id)); toast.success("Video o'chirildi"); };
  if (!isTeacher && !roles.includes("student") && !isStaff) return <p className="text-sm text-muted-foreground">Bu bo'lim siz uchun mavjud emas.</p>;
  return <div className="space-y-6"><header><h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Video darslar</h1><p className="text-sm text-muted-foreground">{isTeacher ? "Guruhingiz uchun video dars joylang." : "Sizning guruhingiz uchun joylangan video darslar."}</p></header>
    {isTeacher && <form onSubmit={upload} className="grid gap-3 rounded-2xl border border-border bg-card p-5 md:grid-cols-2"><label className="text-sm">Sarlavha<input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" placeholder="1-dars: Mavzu" /></label><label className="text-sm">Guruh<select required value={groupId} onChange={(e) => setGroupId(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2">{groups.length ? groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>) : <option value="">Guruh topilmadi</option>}</select></label><label className="text-sm md:col-span-2">Tavsif<textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" /></label><label className="text-sm md:col-span-2">Video fayli (MP4, WebM, MOV; 500 MB gacha)<input id="video-file" required type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" /></label><button disabled={saving || !groups.length} className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{saving ? "Yuklanmoqda..." : "Video darsni joylash"}</button></form>}
    {loading ? <p className="text-sm text-muted-foreground">Yuklanmoqda...</p> : rows.length === 0 ? <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground"><FileVideo className="mx-auto mb-3 h-8 w-8 opacity-50" />Hozircha video dars yo'q.</div> : <div className="grid gap-5 md:grid-cols-2">{rows.map((row) => <article key={row.id} className="overflow-hidden rounded-2xl border border-border bg-card"><video controls preload="metadata" className="aspect-video w-full bg-black" src={row.url} /><div className="p-4"><div className="flex gap-3"><div className="min-w-0 flex-1"><h2 className="font-bold">{row.title}</h2><p className="mt-1 text-xs text-muted-foreground">{row.group?.name ?? "Guruh"} · {new Date(row.created_at).toLocaleDateString("uz-UZ")}</p>{row.description && <p className="mt-3 text-sm text-muted-foreground">{row.description}</p>}</div>{isTeacher && <button onClick={() => void remove(row)} className="h-fit rounded-lg p-2 text-destructive hover:bg-destructive/10" aria-label="O'chirish"><Trash2 className="h-4 w-4" /></button>}</div></div></article>)}</div>}</div>;
}
