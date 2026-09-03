import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, FileImage, Loader2, ReceiptText, XCircle } from "lucide-react";
import { toast } from "sonner";
import { listPaymentReceipts, reviewPaymentReceipt } from "@/lib/receipts.functions";

export const Route = createFileRoute("/_authenticated/payment-receipts")({
  beforeLoad: ({ context }) => {
    const roles = (context as { roles?: string[] }).roles ?? [];
    if (!roles.includes("admin") && !roles.includes("director")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: PaymentReceiptsPage,
  head: () => ({
    meta: [
      { title: "Chek tasdiqlash · Akhmad Academy" },
      {
        name: "description",
        content:
          "Ota-onalar Telegram bot orqali yuborgan to'lov cheklarini administrator va direktor tekshirib tasdiqlaydi.",
      },
      { property: "og:title", content: "Chek tasdiqlash · Akhmad Academy" },
      {
        property: "og:description",
        content: "Telegramdan kelgan to'lov cheklari moliya bo'limida tasdiqlanadi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const money = (value: number) => Number(value || 0).toLocaleString("uz-UZ");

const STATUS_TABS = [
  { key: "pending", label: "Kutilmoqda" },
  { key: "approved", label: "Tasdiqlangan" },
  { key: "rejected", label: "Rad etilgan" },
  { key: "all", label: "Hammasi" },
] as const;

type Draft = { amount: string; method: string; note: string };

function PaymentReceiptsPage() {
  const queryClient = useQueryClient();
  const fetchReceipts = useServerFn(listPaymentReceipts);
  const review = useServerFn(reviewPaymentReceipt);
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]["key"]>("pending");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["payment-receipts", status],
    queryFn: () => fetchReceipts({ data: { status } }),
    staleTime: 30_000,
    refetchInterval: status === "pending" ? 60_000 : false,
  });

  const rows = data ?? [];

  const decide = useMutation({
    mutationFn: (input: {
      receipt_id: string;
      decision: "approve" | "reject";
      amount?: number;
      payment_method?: string;
      note?: string;
    }) => review({ data: input as never }),
    onSuccess: (result, variables) => {
      toast.success(
        variables.decision === "approve"
          ? `To'lov tasdiqlandi${result.notified ? " va ota-onaga xabar yuborildi" : ""}`
          : `Chek rad etildi${result.notified ? " va ota-onaga xabar yuborildi" : ""}`,
      );
      queryClient.invalidateQueries({ queryKey: ["payment-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const draftOf = (row: { id: string; declared_amount: number | null; monthly_fee: number }): Draft =>
    drafts[row.id] ?? {
      amount: String(row.declared_amount ?? row.monthly_fee ?? ""),
      method: "card",
      note: "",
    };

  const setDraft = (id: string, patch: Partial<Draft>, base: Draft) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...base, ...patch } }));

  const pendingTotal = rows
    .filter((row) => row.status === "pending")
    .reduce((sum, row) => sum + Number(row.declared_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Chek tasdiqlash</h1>
          <p className="text-sm text-muted-foreground">
            Ota-ona botga yuborgan to'lov cheki — tekshirib tasdiqlaganingizdan keyin to'lov
            hisobga o'tadi va ota-onaga xabar boradi.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-3 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Kutilayotgan summa
          </div>
          <div className="text-lg font-extrabold">{money(pendingTotal)} so'm</div>
        </div>
      </div>

      <NotificationFailuresPanel />

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatus(tab.key)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              status === tab.key
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <ReceiptText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Bu bo'limda hozircha chek yo'q.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => {
            const draft = draftOf(row as never);
            const isPending = row.status === "pending";
            return (
              <div key={row.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">{row.student_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString("uz-UZ")} ·{" "}
                      {String(row.period_month).slice(0, 7)}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                      row.status === "pending"
                        ? "bg-amber-500/15 text-amber-300"
                        : row.status === "approved"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>

                {row.note && <p className="mt-2 text-xs text-muted-foreground">Izoh: {row.note}</p>}

                <div className="mt-3 overflow-hidden rounded-xl border border-border bg-muted/30">
                  {row.image_url ? (
                    <a href={row.image_url} target="_blank" rel="noreferrer">
                      <img
                        src={row.image_url}
                        alt={`${row.student_name} to'lov cheki`}
                        loading="lazy"
                        decoding="async"
                        className="max-h-64 w-full object-contain"
                      />
                    </a>
                  ) : (
                    <div className="flex h-32 items-center justify-center gap-2 text-xs text-muted-foreground">
                      <FileImage className="h-4 w-4" /> Rasm mavjud emas
                    </div>
                  )}
                </div>

                {isPending ? (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs">
                        <span className="text-muted-foreground">Summa</span>
                        <input
                          value={draft.amount}
                          onChange={(e) => setDraft(row.id, { amount: e.target.value }, draft)}
                          inputMode="numeric"
                          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="text-xs">
                        <span className="text-muted-foreground">To'lov usuli</span>
                        <select
                          value={draft.method}
                          onChange={(e) => setDraft(row.id, { method: e.target.value }, draft)}
                          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                        >
                          <option value="card">Karta</option>
                          <option value="cash">Naqd</option>
                          <option value="transfer">Bank o'tkazmasi</option>
                          <option value="qr">QR</option>
                        </select>
                      </label>
                    </div>
                    <input
                      value={draft.note}
                      onChange={(e) => setDraft(row.id, { note: e.target.value }, draft)}
                      placeholder="Izoh yoki rad etish sababi"
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate({
                            receipt_id: row.id,
                            decision: "approve",
                            amount: Number(draft.amount.replace(/\D/g, "")) || undefined,
                            payment_method: draft.method,
                            note: draft.note || undefined,
                          })
                        }
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Tasdiqlash
                      </button>
                      <button
                        type="button"
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate({
                            receipt_id: row.id,
                            decision: "reject",
                            note: draft.note || undefined,
                          })
                        }
                        className="flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-rose-300 disabled:opacity-60"
                      >
                        <XCircle className="h-4 w-4" /> Rad etish
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-muted-foreground">
                    {row.review_note ? `Izoh: ${row.review_note}` : "Ko'rib chiqilgan"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
