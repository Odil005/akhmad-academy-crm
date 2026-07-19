import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/contact")({
  component: ContactSettings,
});

type ContactInfo = {
  address: string;
  phone: string;
  email: string;
  telegram: string;
  instagram: string;
};

const EMPTY: ContactInfo = { address: "", phone: "", email: "", telegram: "", instagram: "" };

function ContactSettings() {
  const [info, setInfo] = useState<ContactInfo>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("settings").select("value").eq("key", "contact_info").maybeSingle().then(({ data }) => {
      if (data?.value) setInfo({ ...EMPTY, ...(data.value as any) });
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").upsert({
      key: "contact_info",
      scope: "director",
      value: info as any,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saqlandi");
  };

  const fields: { key: keyof ContactInfo; label: string; placeholder: string }[] = [
    { key: "address", label: "Manzil", placeholder: "Toshkent shahri, Chilonzor tumani" },
    { key: "phone", label: "Telefon", placeholder: "+998 90 123 45 67" },
    { key: "email", label: "Email", placeholder: "info@edunest.uz" },
    { key: "telegram", label: "Telegram kanal (URL)", placeholder: "https://t.me/edunest" },
    { key: "instagram", label: "Instagram (URL)", placeholder: "https://instagram.com/edunest" },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Aloqa ma'lumotlari</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Bu maydonlar bosh sahifadagi "Aloqa" bo'limida ko'rsatiladi.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className="block text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</div>
            <input
              value={info[f.key]}
              onChange={(e) => setInfo({ ...info, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
            />
          </label>
        ))}
      </div>
      <button onClick={save} disabled={saving} className="mt-6 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {saving ? "..." : "Saqlash"}
      </button>
    </div>
  );
}
