import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, LocateFixed } from "lucide-react";
import { parseCoordinates, osmEmbedUrl, hasLocation, type SiteLocation } from "@/lib/site-location";

export const Route = createFileRoute("/_authenticated/settings/contact")({
  head: () => ({ meta: [
    { title: "Aloqa sozlamalari | Akhmad CRM" },
    { name: "description", content: "Akhmad CRM \u2014 aloqa sozlamalari va o\u2018quv markazini boshqarish." },
    { property: "og:title", content: "Aloqa sozlamalari | Akhmad CRM" },
    { property: "og:description", content: "Akhmad CRM \u2014 aloqa sozlamalari va o\u2018quv markazini boshqarish." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
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
  const [isDirector, setIsDirector] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: u }) => {
      if (!u.user) return;
      supabase.from("user_roles").select("role").eq("user_id", u.user.id).then(({ data }) => setIsDirector((data ?? []).some((r) => r.role === "director")));
    });
    supabase.from("settings").select("value").eq("key", "contact_info").maybeSingle().then(({ data }) => {
      if (data?.value) setInfo({ ...EMPTY, ...(data.value as any) });
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").upsert({
      key: "contact_info",
      scope: "director",
      is_public: true,
      value: info as any,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saqlandi");
  };

  const fields: { key: keyof ContactInfo; label: string; placeholder: string }[] = [
    { key: "address", label: "Manzil", placeholder: "Toshkent shahri, Chilonzor tumani" },
    { key: "phone", label: "Telefon", placeholder: "+998 90 123 45 67" },
    { key: "email", label: "Email", placeholder: "info@akhmadacademy.uz" },
    { key: "telegram", label: "Telegram kanal (URL)", placeholder: "https://t.me/akhmadacademy" },
    { key: "instagram", label: "Instagram (URL)", placeholder: "https://instagram.com/akhmadacademy" },
  ];

  return (
    <div className="space-y-6">
    <LocationSettings />
    {isDirector && (
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
    )}
    </div>
  );
}

function LocationSettings() {
  const [loc, setLoc] = useState<SiteLocation>({});
  const [raw, setRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.from("settings").select("value").eq("key", "site_location").maybeSingle().then(({ data }) => {
      const v = (data?.value ?? {}) as SiteLocation;
      setLoc(v);
      if (hasLocation(v)) setRaw(`${v.lat}, ${v.lng}`);
    });
  }, []);

  const apply = (text: string) => {
    setRaw(text);
    const c = parseCoordinates(text);
    setErr(c || !text.trim() ? "" : "Koordinatani o'qib bo'lmadi. Masalan: 38.5612, 67.9921 yoki Google Maps havolasi");
    if (c) setLoc((l) => ({ ...l, ...c }));
  };

  const useMine = () => {
    if (!navigator.geolocation) return setErr("Brauzer joylashuvni bermaydi");
    navigator.geolocation.getCurrentPosition(
      (p) => apply(`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`),
      () => setErr("Joylashuvga ruxsat berilmadi"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").update({ value: loc as any }).eq("key", "site_location");
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Joylashuv saqlandi");
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-1 flex items-center gap-2">
        <LocateFixed className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Xaritadagi joylashuv</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Saytdagi «Manzil» bo'limida xarita va «Yo'l ko'rsatish» tugmasi chiqadi. Google Maps havolasini yoki koordinatani qo'ying, yoki markazda turib «Hozirgi joylashuvim»ni bosing.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Havola yoki koordinata</div>
          <input value={raw} onChange={(e) => apply(e.target.value)} placeholder="38.5612, 67.9921" className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
        </label>
        <label className="block text-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mo'ljal (ixtiyoriy)</div>
          <input value={loc.label ?? ""} onChange={(e) => setLoc({ ...loc, label: e.target.value })} placeholder="Masalan: Markaziy bozor yonida" className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
        </label>
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
      {hasLocation(loc) && (
        <iframe title="Xarita" src={osmEmbedUrl(loc.lat, loc.lng)} className="mt-4 h-64 w-full rounded-xl border border-border" loading="lazy" />
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={useMine} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">Hozirgi joylashuvim</button>
        <button onClick={save} disabled={saving || !hasLocation(loc)} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {saving ? "..." : "Joylashuvni saqlash"}
        </button>
      </div>
    </div>
  );
}
