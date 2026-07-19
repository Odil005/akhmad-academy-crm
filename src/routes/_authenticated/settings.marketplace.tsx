import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/marketplace")({
  component: MarketplaceSettings,
});

type Category = { id: string; name: string; slug: string; icon: string | null };
type Product = { id: string; name: string; price: number; category_id: string | null; image_url: string | null; is_available: boolean; product_type: string | null };

function MarketplaceSettings() {
  const [cats, setCats] = useState<Category[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [newCat, setNewCat] = useState({ name: "", slug: "", icon: "" });
  const [newProd, setNewProd] = useState({ name: "", price: 0, category_id: "", image_url: "", product_type: "" });

  const load = async () => {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("marketplace_categories").select("*").order("sort_order"),
      supabase.from("marketplace_products").select("*").order("created_at", { ascending: false }),
    ]);
    setCats((c as any) ?? []);
    setProds((p as any) ?? []);
  };
  useEffect(() => { load(); }, []);

  const addCat = async () => {
    if (!newCat.name || !newCat.slug) return;
    const { error } = await supabase.from("marketplace_categories").insert(newCat);
    if (error) toast.error(error.message); else { toast.success("Qo'shildi"); setNewCat({ name: "", slug: "", icon: "" }); load(); }
  };
  const delCat = async (id: string) => {
    if (!confirm("O'chirilsinmi?")) return;
    await supabase.from("marketplace_categories").delete().eq("id", id);
    load();
  };
  const addProd = async () => {
    if (!newProd.name) return;
    const { error } = await supabase.from("marketplace_products").insert({
      ...newProd, category_id: newProd.category_id || null, image_url: newProd.image_url || null, product_type: newProd.product_type || null,
    });
    if (error) toast.error(error.message); else { toast.success("Qo'shildi"); setNewProd({ name: "", price: 0, category_id: "", image_url: "", product_type: "" }); load(); }
  };
  const toggleAvail = async (p: Product) => {
    await supabase.from("marketplace_products").update({ is_available: !p.is_available }).eq("id", p.id);
    load();
  };
  const delProd = async (id: string) => {
    if (!confirm("O'chirilsinmi?")) return;
    await supabase.from("marketplace_products").delete().eq("id", id);
    load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Kategoriyalar</h2>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-2">
          <input placeholder="Nomi" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-2 text-sm" />
          <input placeholder="slug" value={newCat.slug} onChange={(e) => setNewCat({ ...newCat, slug: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-2 text-sm" />
          <input placeholder="🍎" value={newCat.icon} onChange={(e) => setNewCat({ ...newCat, icon: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-2 text-sm" />
        </div>
        <button onClick={addCat} className="mb-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Plus className="h-3.5 w-3.5" /> Kategoriya qo'shish</button>
        <ul className="divide-y divide-border">
          {cats.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span>{c.icon} {c.name} <span className="text-xs text-muted-foreground">/{c.slug}</span></span>
              <button onClick={() => delCat(c.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Mahsulotlar</h2>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <input placeholder="Mahsulot nomi" value={newProd.name} onChange={(e) => setNewProd({ ...newProd, name: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-2 text-sm" />
          <input placeholder="Narx" type="number" value={newProd.price} onChange={(e) => setNewProd({ ...newProd, price: Number(e.target.value) })} className="rounded-lg border border-border bg-background px-2 py-2 text-sm" />
          <select value={newProd.category_id} onChange={(e) => setNewProd({ ...newProd, category_id: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-2 text-sm">
            <option value="">Kategoriya —</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input placeholder="Rasm URL" value={newProd.image_url} onChange={(e) => setNewProd({ ...newProd, image_url: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-2 text-sm" />
        </div>
        <button onClick={addProd} className="mb-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Plus className="h-3.5 w-3.5" /> Qo'shish</button>
        <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
          {prods.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{Number(p.price).toLocaleString()} so'm</div>
              </div>
              <button onClick={() => toggleAvail(p)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.is_available ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                {p.is_available ? "Mavjud" : "Yo'q"}
              </button>
              <button onClick={() => delProd(p.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
