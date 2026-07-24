import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { createFirstDirector } from "@/lib/bootstrap.functions";
import { Copy, ShieldCheck, LogIn, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { BackgroundAnimation } from "@/components/BackgroundAnimation";

export const Route = createFileRoute("/bootstrap")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Director bootstrap · Akhmad Academy" },
      { name: "description", content: "Birinchi director akkaunti yaratish" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BootstrapPage,
});

type Creds = { email: string; access_code: string; existing?: boolean; reset?: boolean };

function BootstrapPage() {
  const create = useServerFn(createFirstDirector);
  const [creds, setCreds] = useState<Creds | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    create({})
      .then((r) => { if (alive) setCreds(r as Creds); })
      .catch(async (e) => {
        if (!alive) return;
        // Try to read Response body when the server fn threw a Response
        try {
          if (e instanceof Response) setError(await e.text());
          else setError(e?.message ?? "Xatolik");
        } catch { setError("Xatolik"); }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [create]);

  const copy = (label: string, v: string) => {
    navigator.clipboard.writeText(v);
    toast.success(`${label} nusxalandi`);
  };
  const copyBoth = () => {
    if (!creds) return;
    navigator.clipboard.writeText(`Email: ${creds.email}\nKod: ${creds.access_code}`);
    toast.success("Email va kod nusxalandi");
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <BackgroundAnimation variant="subtle" />
      <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-10">
        <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-xl md:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-primary/15 p-2.5 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold md:text-2xl">Director kirish kodi</h1>
              <p className="text-xs text-muted-foreground">
                {creds?.existing ? "Mavjud director akkaunti" : "Birinchi director akkaunti — bir marta yaratiladi"}
              </p>
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Ma'lumotlar tayyorlanmoqda...
            </div>
          )}

          {!loading && error && (
            <div className="space-y-4">
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
              <Link to="/auth" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
                <LogIn className="h-4 w-4" /> Kirish sahifasiga o'tish
              </Link>
            </div>
          )}

          {!loading && creds && (
            <div className="space-y-4">
              <p className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs text-foreground/80">
                {creds.reset
                  ? "🔁 Director akkaunti topildi, lekin saqlangan kodi yo'q edi — yangi access_code yaratildi. Endi shu kod bilan kiring."
                  : creds.existing
                    ? "ℹ️ Director akkaunti allaqachon mavjud. Saqlangan email va kod pastda."
                    : "⚠️ Bu ma'lumotlarni hoziroq nusxalab, xavfsiz joyda saqlang."}
              </p>

              <CredRow label="Email" value={creds.email} onCopy={() => copy("Email", creds.email)} />
              <CredRow label="Access code" value={creds.access_code} mono onCopy={() => copy("Kod", creds.access_code)} />

              <button
                onClick={copyBoth}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:border-primary"
              >
                <Copy className="h-4 w-4" /> Ikkalasini birga nusxalash
              </button>

              <Link
                to="/auth"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                <LogIn className="h-4 w-4" /> Kirish sahifasiga o'tish
              </Link>

              <p className="text-center text-[11px] text-muted-foreground">
                Kirishdan so'ng <b>/settings/credentials</b> orqali admin/teacher/student loginlarini yarating.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CredRow({ label, value, mono, onCopy }: { label: string; value: string; mono?: boolean; onCopy: () => void }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-3">
        <div className={`min-w-0 flex-1 truncate text-sm ${mono ? "font-mono" : ""}`}>{value}</div>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          <Copy className="h-3.5 w-3.5" /> Nusxa
        </button>
      </div>
    </div>
  );
}
