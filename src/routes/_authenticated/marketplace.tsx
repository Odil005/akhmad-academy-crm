import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/marketplace")({
  component: MarketplacePage,
});

type Cat = { id: string; name: string; slug: string; icon: string | null };
type Prod = { id: string; name: string; price: number; image_url: string | null; description: string | null; category_id: string | null; is_available: boolean };

function MarketplacePage() {
  const { user, roles } = Route.useRouteContext();
  const [cats, setCats] = useState<Cat[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [active, setActive] = useState<string | "all">("all");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [revenue, setRevenue] = useState<{ cat: string; total: number; count: number }[]>([]);
  const isStaff = roles.includes("director") || roles.includes("admin");

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: p }, { data: s }] = await Promise.all([
        supabase.from("marketplace_categories").select("*").order("sort_order"),
        supabase.from("marketplace_products").select("*").eq("is_available", true).order("name"),
        supabase.from("students").select("id").eq("profile_id", user.id).maybeSingle(),
      ]);
      setCats((c as any) ?? []);
      setProds((p as any) ?? []);
      setStudentId((s as any)?.id ?? null);

      if (roles.includes("director") || roles.includes("admin")) {
        const { data: orders } = await supabase
          .from("marketplace_orders")
          .select("total, status, product:marketplace_products(category:marketplace_categories(name))");
        const byCat: Record<string, { total: number; count: number }> = {};
        (orders ?? []).forEach((o: any) => {
          if (o.status === "cancelled") return;
          const catName = o.product?.category?.name ?? "Boshqa";
          byCat[catName] ??= { total: 0, count: 0 };
          byCat[catName].total += Number(o.total);
          byCat[catName].count += 1;
        });
        setRevenue(Object.entries(byCat).map(([cat, v]) => ({ cat, ...v })).sort((a, b) => b.total - a.total));
      }
    })();
  }, [user.id, roles]);


  const filtered = active === "all" ? prods : prods.filter((p) => p.category_id === active);
  const canOrder = roles.includes("student") && studentId;

  const order = async (p: Prod) => {
    if (!studentId) return;
    const { error } = await supabase.from("marketplace_orders").insert({
      product_id: p.id, student_id: studentId, ordered_by: user.id,
      quantity: 1, unit_price: p.price, total: p.price,
    });
    if (error) toast.error(error.message); else toast.success("Buyurtma berildi");
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold md:text-3xl">
          <ShoppingBag className="h-6 w-6 text-primary" /> Marketplace
        </h1>
        <p className="text-sm text-muted-foreground">Akhmad Academy do'koni — kitoblar, ichimliklar, kanstovarlar va boshqalar</p>
      </header>

      {isStaff && revenue.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-bold uppercase text-muted-foreground">Kategoriya bo'yicha tushum (avtomatik)</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {revenue.map((r) => (
              <div key={r.cat} className="rounded-xl bg-primary/5 p-3">
                <div className="text-xs text-muted-foreground">{r.cat}</div>
                <div className="text-lg font-extrabold">{r.total.toLocaleString()} so'm</div>
                <div className="text-[10px] text-muted-foreground">{r.count} buyurtma</div>
              </div>
            ))}
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <div className="text-xs text-muted-foreground">Jami</div>
              <div className="text-lg font-extrabold text-emerald-600">
                {revenue.reduce((a, r) => a + r.total, 0).toLocaleString()} so'm
              </div>
            </div>
          </div>
        </div>
      )}



      <div className="flex flex-wrap gap-2">
        <button onClick={() => setActive("all")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active === "all" ? "bg-primary text-primary-foreground" : "border border-border"}`}>Barchasi</button>
        {cats.map((c) => (
          <button key={c.id} onClick={() => setActive(c.id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active === c.id ? "bg-primary text-primary-foreground" : "border border-border"}`}>
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Package className="mx-auto mb-2 h-8 w-8" /> Mahsulot yo'q
          </div>
        )}
        {filtered.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="aspect-square overflow-hidden rounded-lg bg-secondary/30">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl">📦</div>
              )}
            </div>
            <h3 className="mt-3 truncate text-sm font-bold">{p.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2">{p.description || "\u00a0"}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-extrabold">{Number(p.price).toLocaleString()} so'm</span>
              {canOrder && (
                <button onClick={() => order(p)} className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                  Buyurtma
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
