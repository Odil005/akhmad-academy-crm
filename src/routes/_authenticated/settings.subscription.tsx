import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarClock, CheckCircle2, Loader2, Users } from "lucide-react";
import { getMyCenterBilling } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/settings/subscription")({
  component: SubscriptionPage,
});

const money = (v: number) => Number(v || 0).toLocaleString("uz-UZ");

function SubscriptionPage() {
  const fetchBilling = useServerFn(getMyCenterBilling);
  const { data, isLoading } = useQuery({
    queryKey: ["settings", "subscription"],
    queryFn: () => fetchBilling(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda…
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Markaz ma'lumoti topilmadi.</p>;
  }

  const sub = data.subscription;
  const end = sub?.current_period_end ? new Date(String(sub.current_period_end)) : null;
  const daysLeft = end ? Math.ceil((end.getTime() - Date.now()) / 86400000) : null;
  const suspended = data.center?.status === "suspended";

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-extrabold">Abonent (UNI CRM)</h2>
        <p className="text-sm text-muted-foreground">
          {data.center?.name} — joriy tarif, keyingi to'lov sanasi va hisob-fakturalar.
        </p>
      </header>

      {suspended && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          Markaz bloklangan — abonent to'lovi amalga oshirilgandan so'ng avtomatik ochiladi.
        </div>
      )}
      {!suspended && daysLeft !== null && daysLeft <= 5 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          <CalendarClock className="mt-0.5 h-4 w-4" />
          Abonent muddati {daysLeft} kundan keyin tugaydi. To'lovni oldindan amalga oshiring.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card label="Oylik to'lov" value={`${money(Number(sub?.monthly_price ?? 0))} so'm`} />
        <Card label="Keyingi to'lov" value={sub?.current_period_end ?? "—"} />
        <Card label="Qarz" value={`${money(data.debt)} so'm`} />
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
        <Users className="h-5 w-5 text-primary" />
        O'quvchilar: <strong>{data.students}</strong> / {data.center?.student_limit} (tarif limiti)
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-bold">Hisob-fakturalar</div>
        {data.invoices.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Hozircha hisob-faktura yo'q.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Davr</th>
                <th className="px-4 py-2 text-left">Muddat</th>
                <th className="px-4 py-2 text-right">Summa</th>
                <th className="px-4 py-2 text-left">Holat</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((i: any) => (
                <tr key={i.id} className="border-t border-border/60">
                  <td className="px-4 py-2">{String(i.period_month).slice(0, 7)}</td>
                  <td className="px-4 py-2">{i.due_date}</td>
                  <td className="px-4 py-2 text-right">{money(Number(i.amount))}</td>
                  <td className="px-4 py-2">
                    {i.status === "paid" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> To'langan
                      </span>
                    ) : (
                      <span className="text-amber-300">To'lanmagan</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        To'lov Payme yoki Click orqali onlayn qabul qilinishi keyingi bosqichda yoqiladi. Hozircha
        to'lovni platforma egasi tasdiqlaydi va abonent avtomatik uzayadi.
      </p>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-extrabold">{value}</p>
    </div>
  );
}
