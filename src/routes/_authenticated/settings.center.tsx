import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { getMyCenterProfile, updateMyCenter } from "@/lib/tenant.functions";

export const Route = createFileRoute("/_authenticated/settings/center")({
  head: () => ({ meta: [
    { title: "Markaz profili | Akhmad CRM" },
    { name: "description", content: "Markaz nomi, logotipi, telefoni va manzilini boshqarish." },
    { property: "og:title", content: "Markaz profili | Akhmad CRM" },
    { property: "og:description", content: "Markaz nomi, logotipi, telefoni va manzilini boshqarish." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CenterProfilePage,
});

type Profile = {
  id: string;
  name: string;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  is_flagship: boolean;
  custom_domain: string | null;
};

function CenterProfilePage() {
  const fetchProfile = useServerFn(getMyCenterProfile);
  const saveCenter = useServerFn(updateMyCenter);
  const [p, setP] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProfile()
      .then((data) => setP(data as Profile | null))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [fetchProfile]);

  const save = useMutation({
    mutationFn: (input: { data: { name: string; logo_url: string | null; phone: string | null; address: string | null } }) => saveCenter(input),
    onSuccess: () => toast.success("Markaz profili saqlandi"),
    onError: (e: Error) => setError(e.message),
  });

  if (loading) return <div className="text-sm text-muted-foreground">Yuklanmoqda...</div>;
  if (!p) return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Sizga markaz biriktirilmagan.</div>;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Markaz profili</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Markaz nomi" value={p.name} onChange={(v) => setP({ ...p, name: v })} />
        <Field label="Logotip URL" value={p.logo_url ?? ""} onChange={(v) => setP({ ...p, logo_url: v })} placeholder="https://..." />
        <Field label="Telefon" value={p.phone ?? ""} onChange={(v) => setP({ ...p, phone: v })} placeholder="+998 90 000 00 00" />
        <Field label="Manzil" value={p.address ?? ""} onChange={(v) => setP({ ...p, address: v })} />
        <div className="text-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sayt domeni</div>
          <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-muted-foreground">{p.custom_domain ?? "Domen ulanmagan"}</div>
        </div>
      </div>
      {p.logo_url ? (
        <div className="mt-4 flex items-center gap-3">
          <img src={p.logo_url} alt="Logotip" className="h-12 w-12 rounded-xl object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <span className="text-xs text-muted-foreground">Logotip ko'rinishi — yuqoridagi URL sahifada chiqadi.</span>
        </div>
      ) : null}
      <button
        disabled={save.isPending}
        onClick={() => {
          setError("");
          save.mutate({ data: { name: p.name.trim(), logo_url: p.logo_url?.trim() || null, phone: p.phone?.trim() || null, address: p.address?.trim() || null } });
        }}
        className="mt-6 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {save.isPending ? "Saqlanmoqda..." : "Saqlash"}
      </button>
      {error && <p role="alert" className="mt-3 break-words text-sm text-destructive">{error}</p>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block text-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
    </label>
  );
}
