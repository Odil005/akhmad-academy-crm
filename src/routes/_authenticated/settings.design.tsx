import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Palette } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/design")({
  component: DesignPage,
});

type Design = {
  id?: string;
  logo_url: string | null;
  hero_image_url: string | null;
  animated_bg_url: string | null;
  animation_enabled: boolean;
  primary_color: string | null;
  secondary_color: string | null;
  main_headline: string | null;
  main_subheadline: string | null;
};

function DesignPage() {
  const [d, setD] = useState<Design | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("design_settings").select("*").eq("is_active", true).maybeSingle().then(({ data }) => {
      setD((data as any) ?? { logo_url: "", hero_image_url: "", animated_bg_url: "", animation_enabled: true, primary_color: "#FACC15", secondary_color: "#0A0A0A", main_headline: "", main_subheadline: "" });
    });
  }, []);

  const save = async () => {
    if (!d) return;
    setSaving(true);
    const payload = { ...d, is_active: true };
    const { error } = d.id
      ? await supabase.from("design_settings").update(payload).eq("id", d.id)
      : await supabase.from("design_settings").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saqlandi");
  };

  if (!d) return <div className="text-sm text-muted-foreground">Yuklanmoqda...</div>;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Palette className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Dizayn sozlamalari</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Logotip URL" value={d.logo_url ?? ""} onChange={(v) => setD({ ...d, logo_url: v })} />
        <Field label="Hero rasm URL" value={d.hero_image_url ?? ""} onChange={(v) => setD({ ...d, hero_image_url: v })} />
        <Field label="Animatsion fon URL" value={d.animated_bg_url ?? ""} onChange={(v) => setD({ ...d, animated_bg_url: v })} />
        <label className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
          <input type="checkbox" checked={d.animation_enabled} onChange={(e) => setD({ ...d, animation_enabled: e.target.checked })} />
          <span className="text-sm">Animatsiya yoqilgan</span>
        </label>
        <Field label="Asosiy rang (hex)" value={d.primary_color ?? ""} onChange={(v) => setD({ ...d, primary_color: v })} />
        <Field label="Ikkilamchi rang (hex)" value={d.secondary_color ?? ""} onChange={(v) => setD({ ...d, secondary_color: v })} />
        <Field label="Asosiy sarlavha" value={d.main_headline ?? ""} onChange={(v) => setD({ ...d, main_headline: v })} />
        <Field label="Yordamchi matn" value={d.main_subheadline ?? ""} onChange={(v) => setD({ ...d, main_subheadline: v })} />
      </div>
      <button onClick={save} disabled={saving} className="mt-6 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {saving ? "..." : "Saqlash"}
      </button>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
    </label>
  );
}
