import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Banknote, CreditCard, Globe, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { closeCashShift, getShiftExpected } from "@/lib/collections.functions";

export const Route = createFileRoute("/_authenticated/cash-shifts")({
  component: CashShiftsPage,
  head: () => ({
    meta: [
      { title: "Kassa yopilishi · Akhmad Academy" },
      {
        name: "description",
        content: "Kunlik kassa sverkasi: kutilgan va sanalgan naqd, karta, online summalar hamda farq.",
      },
      { property: "og:title", content: "Kassa yopilishi · Akhmad Academy" },
      {
        property: "og:description",
        content: "Har kunlik kassa yopilishi va direktorga avtomatik Telegram xulosa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const money = (value: number) => Number(value || 0).toLocaleString("uz-UZ");

function CashShiftsPage() {
  const fetchExpected = useServerFn(getShiftExpected);
  const closeShift = useServerFn(closeCashShift);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [counted, setCounted] = useState({ cash: "", card: "", online: "" });
  const [note, setNote] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["cash-shift", date],
    queryFn: () => fetchExpected({ data: { shift_date: date } }),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!data) return;
    setCounted({
      cash: String(data.shift?.counted_cash ?? data.totals.cash ?? 0),
      card: String(data.shift?.counted_card ?? data.totals.card ?? 0),
      online: String(data.shift?.counted_online ?? data.totals.online ?? 0),
    });
    setNote(data.shift?.note ?? "");
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      closeShift({
        data: {
          shift_date: date,
          counted_cash: Number(counted.cash || 0),
          counted_card: Number(counted.card || 0),
          counted_online: Number(counted.online || 0),
          note: note || undefined,
        },
      }),
    onSuccess: (result) => {
      toast.success(
        result.difference === 0
          ? "Kassa farqsiz yopildi"
          : `Kassa yopildi · farq ${money(result.difference)} so'm`,
      );
      if (result.notified) toast.info(`Direktorga ${result.notified} xabar yuborildi`);
      void refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const totals = data?.totals ?? { cash: 0, card: 0, online: 0 };
  const countedTotal = Number(counted.cash || 0) + Number(counted.card || 0) + Number(counted.online || 0);
  const difference = countedTotal - (totals.cash + totals.card + totals.online);

  const fields = [
    { key: "cash" as const, label: "Naqd", icon: Banknote, expected: totals.cash },
    { key: "card" as const, label: "Karta", icon: CreditCard, expected: totals.card },
    { key: "online" as const, label: "Online / o'tkazma", icon: Globe, expected: totals.online },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kassa yopilishi</h1>
          <p className="text-sm text-muted-foreground">
            Kun oxirida sanalgan summani kiriting — farq hisoblanadi va direktorga Telegram xulosa ketadi.
          </p>
        </div>
        <label className="text-sm">
          Sana
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="ml-2 rounded-lg border border-border/60 bg-background px-3 py-2"
          />
        </label>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {fields.map((field) => (
              <div key={field.key} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <field.icon className="h-4 w-4" /> {field.label}
                </div>
                <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">Kutilgan</p>
                <p className="text-lg font-semibold">{money(field.expected)} so'm</p>
                <label className="mt-3 block text-xs uppercase tracking-wide text-muted-foreground">
                  Sanaldi
                  <input
                    type="number"
                    min={0}
                    value={counted[field.key]}
                    onChange={(event) =>
                      setCounted((prev) => ({ ...prev, [field.key]: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-base font-medium"
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Farq</p>
                <p
                  className={`text-2xl font-semibold ${
                    difference === 0 ? "text-emerald-400" : difference > 0 ? "text-sky-400" : "text-rose-400"
                  }`}
                >
                  {money(difference)} so'm
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                Kutilgan jami: {money(totals.cash + totals.card + totals.online)} so'm · Sanaldi:{" "}
                {money(countedTotal)} so'm
              </div>
            </div>
            <label className="mt-4 block text-sm">
              Izoh
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                placeholder="Kamomad sababi, qo'lda qabul qilingan to'lovlar va h.k."
                className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2"
              />
            </label>
            <div className="mt-4 flex items-center justify-between gap-3">
              {data?.shift ? (
                <p className="text-xs text-muted-foreground">
                  Oxirgi yopilish: {new Date(data.shift.closed_at as string).toLocaleString("uz-UZ")}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Bu kun uchun kassa hali yopilmagan</p>
              )}
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Kassani yopish
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
