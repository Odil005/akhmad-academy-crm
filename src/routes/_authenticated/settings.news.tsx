import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Megaphone, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/news")({
  component: NewsSettings,
});

function NewsSettings() {
  const [news, setNews] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [n, setN] = useState({ title: "", body: "", image_url: "" });
  const [b, setB] = useState({ title: "", image_url: "", link_url: "", position: "home_hero" });

  const load = async () => {
    const [{ data: nd }, { data: bd }] = await Promise.all([
      supabase.from("news").select("*").order("published_at", { ascending: false }),
      supabase.from("banners").select("*").order("sort_order"),
    ]);
    setNews(nd ?? []); setBanners(bd ?? []);
  };
  useEffect(() => { load(); }, []);

  const addNews = async () => {
    if (!n.title) return;
    const { error } = await supabase.from("news").insert(n);
    if (error) toast.error(error.message); else { setN({ title: "", body: "", image_url: "" }); load(); }
  };
  const delNews = async (id: string) => { await supabase.from("news").delete().eq("id", id); load(); };
  const addBanner = async () => {
    if (!b.image_url) return toast.error("Rasm URL kerak");
    const { error } = await supabase.from("banners").insert(b);
    if (error) toast.error(error.message); else { setB({ title: "", image_url: "", link_url: "", position: "home_hero" }); load(); }
  };
  const delBanner = async (id: string) => { await supabase.from("banners").delete().eq("id", id); load(); };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold">Yangiliklar</h2></div>
        <div className="space-y-2">
          <input placeholder="Sarlavha" value={n.title} onChange={(e) => setN({ ...n, title: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <textarea placeholder="Matn" value={n.body} onChange={(e) => setN({ ...n, body: e.target.value })} className="min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input placeholder="Rasm URL" value={n.image_url} onChange={(e) => setN({ ...n, image_url: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button onClick={addNews} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Plus className="h-3.5 w-3.5" /> Qo'shish</button>
        </div>
        <ul className="mt-4 max-h-72 overflow-y-auto divide-y divide-border">
          {news.map((x) => (
            <li key={x.id} className="flex items-center justify-between py-2 text-sm">
              <span className="truncate">{x.title}</span>
              <button onClick={() => delNews(x.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold">Bannerlar</h2></div>
        <div className="space-y-2">
          <input placeholder="Sarlavha (ixtiyoriy)" value={b.title} onChange={(e) => setB({ ...b, title: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input placeholder="Rasm URL *" value={b.image_url} onChange={(e) => setB({ ...b, image_url: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input placeholder="Havola URL" value={b.link_url} onChange={(e) => setB({ ...b, link_url: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <select value={b.position} onChange={(e) => setB({ ...b, position: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="home_hero">home_hero</option>
            <option value="home_middle">home_middle</option>
            <option value="crm_top">crm_top</option>
          </select>
          <button onClick={addBanner} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Plus className="h-3.5 w-3.5" /> Qo'shish</button>
        </div>
        <ul className="mt-4 max-h-72 overflow-y-auto divide-y divide-border">
          {banners.map((x) => (
            <li key={x.id} className="flex items-center justify-between py-2 text-sm">
              <span className="truncate">{x.title || x.position}</span>
              <button onClick={() => delBanner(x.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
