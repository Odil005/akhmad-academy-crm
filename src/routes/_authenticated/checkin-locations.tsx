import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Crosshair, Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isStaff as hasStaffRole } from "@/lib/authz";
import type { CheckinLocation } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/checkin-locations")({
  component: CheckinLocationsPage,
  head: () => ({
    meta: [
      { title: "Face ID lokatsiyalari · Akhmad Academy" },
      {
        name: "description",
        content:
          "Face ID kirishi uchun ruxsat etilgan aniq lokatsiyalar: koordinata, radius va faollik holati.",
      },
      { property: "og:title", content: "Face ID lokatsiyalari · Akhmad Academy" },
      {
        property: "og:description",
        content: "O'quv markaz filiallarining aniq koordinatalarini belgilang va kirishni nazorat qiling.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = CheckinLocation & { active: boolean };

function CheckinLocationsPage() {
  const { roles } = Route.useRouteContext();
  const canManage = hasStaffRole(roles);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", latitude: "", longitude: "", radius_m: "150" });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("checkin_locations")
      .select("id, name, address, latitude, longitude, radius_m, active")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data as Row[] | null) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const useMyPosition = () => {
    if (!navigator.geolocation) return toast.error("Brauzer lokatsiyani qo'llab-quvvatlamaydi");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        toast.success("Hozirgi joylashuv olindi");
      },
      () => {
        setLocating(false);
        toast.error("Lokatsiyaga ruxsat berilmadi");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!form.name.trim()) return toast.error("Lokatsiya nomini kiriting");
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return toast.error("Koordinatalar to'g'ri kiritilmagan");
    }
    setSaving(true);
    const { error } = await supabase.from("checkin_locations").insert({
      name: form.name.trim(),
      address: form.address.trim() || null,
      latitude,
      longitude,
      radius_m: Math.max(20, Number(form.radius_m) || 150),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Lokatsiya qo'shildi");
    setForm({ name: "", address: "", latitude: "", longitude: "", radius_m: "150" });
    void load();
  };

  const toggleActive = async (row: Row) => {
    const { error } = await supabase
      .from("checkin_locations")
      .update({ active: !row.active })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const remove = async (row: Row) => {
    if (!confirm(`"${row.name}" o'chirilsinmi?`)) return;
    const { error } = await supabase.from("checkin_locations").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("O'chirildi");
    void load();
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <MapPin className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-xl font-extrabold">Face ID lokatsiyalari</h1>
          <p className="text-sm text-muted-foreground">
            Kirish faqat shu nuqtalar radiusida bo'lsa "hududda" deb belgilanadi.
          </p>
        </div>
      </header>

      {canManage && (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold">Yangi lokatsiya</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Filial nomi (masalan: Asosiy bino)"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Manzil (ixtiyoriy)"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              placeholder="Latitude (41.311081)"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
            />
            <input
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              placeholder="Longitude (69.240562)"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
            />
            <input
              value={form.radius_m}
              onChange={(e) => setForm({ ...form, radius_m: e.target.value })}
              placeholder="Radius (metr)"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
            />
            <button
              type="button"
              onClick={useMyPosition}
              disabled={locating}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-primary disabled:opacity-60"
            >
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              Hozirgi joylashuvni olish
            </button>
          </div>
          <button
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Saqlash
          </button>
        </form>
      )}

      <section className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-4 text-sm font-bold">Ruxsat etilgan nuqtalar</div>
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Yuklanmoqda...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Hali lokatsiya qo'shilmagan.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {row.name}
                    {!row.active && <span className="ml-2 text-xs text-muted-foreground">(o'chirilgan)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.address ? `${row.address} · ` : ""}
                    {row.latitude.toFixed(6)}, {row.longitude.toFixed(6)} · radius {row.radius_m} m
                  </p>
                  <a
                    href={`https://maps.google.com/?q=${row.latitude},${row.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Xaritada ko'rish
                  </a>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void toggleActive(row)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary"
                    >
                      {row.active ? "O'chirish" : "Yoqish"}
                    </button>
                    <button
                      onClick={() => void remove(row)}
                      className="rounded-lg border border-border p-1.5 text-destructive hover:border-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
