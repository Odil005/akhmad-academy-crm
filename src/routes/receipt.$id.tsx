import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPublicReceipt } from "@/lib/payments.functions";
import { ReceiptView, type ReceiptData } from "@/components/ReceiptView";
import { Printer, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/receipt/$id")({
  component: ReceiptPage,
  head: () => ({
    meta: [
      { title: "To'lov cheki — Akhmad Academy" },
      { name: "description", content: "Akhmad Academy o'quv markazi to'lov cheki: summa, davr, kurs va fiskal ma'lumotlar." },
      { property: "og:title", content: "To'lov cheki — Akhmad Academy" },
      { property: "og:description", content: "Akhmad Academy to'lov cheki va fiskal ma'lumotlari." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ReceiptPage() {
  const { id } = Route.useParams();
  const [data, setData] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPublicReceipt({ data: { payment_id: id } })
      .then((d) => { if (alive) setData(d as unknown as ReceiptData); })
      .catch(() => { if (alive) setError("Chek topilmadi"); });
    return () => { alive = false; };
  }, [id]);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-bold">To'lov cheki</h1>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Printer className="h-4 w-4" /> Chekni chiqarish
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary"
            >
              <Download className="h-4 w-4" /> PDF yuklab olish
            </button>
          </div>
        </div>

        {error && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
        {!error && !data && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" /> Yuklanmoqda...</p>
        )}
        {data && (
          <div className="overflow-hidden rounded-xl border border-border bg-white p-2 shadow-sm print:border-0 print:p-0 print:shadow-none">
            <ReceiptView data={data} />
          </div>
        )}
      </div>
    </div>
  );
}
