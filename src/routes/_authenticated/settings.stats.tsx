import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/stats")({
  component: StatsSettings,
});

type Stats = {
  students: string;
  courses: string;
  teachers: string;
  satisfaction: string;
};

const EMPTY: Stats = { students: "", courses: "", teachers: "", satisfaction: "" };

function StatsSettings() {
  const [s, setS] = useState<Stats>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "homepage_stats")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setS({ ...EMPTY, ...(data.value as any) });
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").upsert({
      key: "homepage_stats",
      scope: "shared",
      value: s as any,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saqlandi");
  };

  const fields: { key: keyof Stats; label: string; placeholder: string }[] = [
    { key: "students", label: "O'quvchilar", placeholder: "1200+" },
    { key: "courses", label: "Kurslar", placeholder: "50+" },
    { key: "teachers", label: "O'qituvchilar", placeholder: "35+" },
    { key: "satisfaction", label: "Mamnun o'quvchilar", placeholder: "98%" },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Bosh sahifa raqamlari</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Bu raqamlar bosh sahifadagi statistika bo'limida ko'rsatiladi. Istalgan qiymat yozing (masalan: 1500+, 99%).
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className="block text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</div>
            <input
              value={s[f.key]}
              onChange={(e) => setS({ ...s, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
            />
          </label>
        ))}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="mt-6 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saving ? "..." : "Saqlash"}
      </button>
    </div>
  );
}
