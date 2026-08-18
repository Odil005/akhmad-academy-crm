import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarClock, Loader2, Send, SplitSquareHorizontal } from "lucide-react";
import { toast } from "sonner";
import { createPaymentPlan, listDebtors, sendDebtReminders } from "@/lib/collections.functions";

export const Route = createFileRoute("/_authenticated/debtors")({
  component: DebtorsPage,
  head: () => ({
    meta: [
      { title: "Qarzdorlar paneli · Akhmad Academy" },
      {
        name: "description",
        content:
          "Qarzdor o'quvchilar, kechikish kunlari, avtomatik Telegram eslatmalari va bo'lib to'lash rejalari.",
      },
      { property: "og:title", content: "Qarzdorlar paneli · Akhmad Academy" },
      {
        property: "og:description",
        content: "Qarzni undirishni avtomatlashtirish: eslatma zinapoyasi va to'lov rejalari.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const money = (value: number) => Number(value || 0).toLocaleString("uz-UZ");

const STAGE_META: Record<string, { label: string; className: string }> = {
  soft: { label: "Muddat yaqin", className: "bg-emerald-500/15 text-emerald-300" },
  due: { label: "Muddat o'tdi", className: "bg-amber-500/15 text-amber-300" },
  firm: { label: "7 kungacha", className: "bg-orange-500/15 text-orange-300" },
  urgent: { label: "14 kungacha", className: "bg-rose-500/15 text-rose-300" },
  final: { label: "Kritik", className: "bg-red-600/20 text-red-300" },
};

function DebtorsPage() {
  const queryClient = useQueryClient();
  const fetchDebtors = useServerFn(listDebtors);
  const sendReminders = useServerFn(sendDebtReminders);
  const createPlan = useServerFn(createPaymentPlan);

  const [selected, setSelected] = useState<string[]>([]);
  const [planFor, setPlanFor] = useState<{ id: string; name: string; debt: number } | null>(null);
  const [planForm, setPlanForm] = useState({ parts: "3", first_due_date: "", notify: true });

  const { data, isLoading } = useQuery({
    queryKey: ["debtors"],
    queryFn: () => fetchDebtors({ data: undefined as never }),
    staleTime: 60_000,
  });

  const rows = data ?? [];
  const totals = useMemo(
    () => ({
      count: rows.length,
      amount: rows.reduce((sum, row) => sum + Number(row.debt_total ?? 0), 0),
      critical: rows.filter((row) => row.days_overdue > 14).length,
      noTelegram: rows.filter((row) => !row.parent_chat_id).length,
    }),
    [rows],
  );

  const remindMutation = useMutation({
    mutationFn: (ids: string[]) => sendReminders({ data: { student_ids: ids } }),
    onSuccess: (result) => {
      toast.success(`${result.sent} eslatma yuborildi${result.skipped ? `, ${result.skipped} o'tkazildi` : ""}`);
      result.errors.slice(0, 3).forEach((message) => toast.warning(message));
      setSelected([]);
      void queryClient.invalidateQueries({ queryKey: ["debtors"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const planMutation = useMutation({
    mutationFn: async () => {
      if (!planFor) throw new Error("O'quvchi tanlanmagan");
      if (!planForm.first_due_date) throw new Error("Birinchi to'lov sanasini kiriting");
      return createPlan({
        data: {
          student_id: planFor.id,
          total_amount: planFor.debt,
          parts: Number(planForm.parts),
          first_due_date: planForm.first_due_date,
          notify_parent: planForm.notify,
        },
      });
    },
    onSuccess: (result) => {
      toast.success(
        `To'lov rejasi tuzildi (${result.installments.length} bo'lak)${result.notified ? " · ota-onaga yuborildi" : ""}`,
      );
      setPlanFor(null);
      void queryClient.invalidateQueries({ queryKey: ["debtors"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Qarzdorlar paneli</h1>
          <p className="text-sm text-muted-foreground">
            Kechikish darajasiga qarab eslatma matni avtomatik tanlanadi va Telegram orqali yuboriladi.
          </p>
        </div>
        <button
          type="button"
          disabled={!selected.length || remindMutation.isPending}
          onClick={() => remindMutation.mutate(selected)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {remindMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Eslatma yuborish ({selected.length})
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Qarzdorlar", value: String(totals.count) },
          { label: "Jami qarz", value: `${money(totals.amount)} so'm` },
          { label: "14+ kun kechikkan", value: String(totals.critical) },
          { label: "Telegram ID yo'q", value: String(totals.noTelegram) },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border/60 bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="Hammasini tanlash"
                  checked={!!rows.length && selected.length === rows.length}
                  onChange={(event) =>
                    setSelected(event.target.checked ? rows.map((row) => row.student_id) : [])
                  }
                />
              </th>
              <th className="px-3 py-3">O'quvchi</th>
              <th className="px-3 py-3">Guruh</th>
              <th className="px-3 py-3">Qarz</th>
              <th className="px-3 py-3">Kechikish</th>
              <th className="px-3 py-3">Holat</th>
              <th className="px-3 py-3">Oxirgi eslatma</th>
              <th className="px-3 py-3">Amal</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            )}
            {!isLoading && !rows.length && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                  Qarzdor yo'q — barcha to'lovlar yopilgan 🎉
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const stage = STAGE_META[row.stage] ?? STAGE_META.due;
              return (
                <tr key={row.student_id} className="border-t border-border/50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`${row.student_name} tanlash`}
                      checked={selected.includes(row.student_id)}
                      onChange={() => toggle(row.student_id)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{row.student_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.parent_phone ?? "telefon yo'q"}
                      {!row.parent_chat_id && (
                        <span className="ml-2 inline-flex items-center gap-1 text-amber-400">
                          <AlertTriangle className="h-3 w-3" /> Telegram yo'q
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{row.group_name ?? "—"}</td>
                  <td className="px-3 py-3 font-semibold">{money(Number(row.debt_total))} so'm</td>
                  <td className="px-3 py-3">
                    {row.days_overdue > 0 ? `${row.days_overdue} kun` : "muddat kelmagan"}
                    <div className="text-xs text-muted-foreground">{row.periods} oy</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${stage.className}`}>
                      {stage.label}
                    </span>
                    {row.has_plan && (
                      <span className="ml-2 text-xs text-sky-300">reja bor</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {row.last_reminder_at
                      ? new Date(row.last_reminder_at).toLocaleDateString("uz-UZ")
                      : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => remindMutation.mutate([row.student_id])}
                        disabled={remindMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs hover:bg-muted/50 disabled:opacity-50"
                      >
                        <Send className="h-3 w-3" /> Eslatma
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPlanFor({
                            id: row.student_id,
                            name: row.student_name,
                            debt: Number(row.debt_total),
                          });
                          setPlanForm({
                            parts: "3",
                            first_due_date: new Date().toISOString().slice(0, 10),
                            notify: true,
                          });
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs hover:bg-muted/50"
                      >
                        <SplitSquareHorizontal className="h-3 w-3" /> Bo'lib to'lash
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {planFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarClock className="h-5 w-5" /> To'lov rejasi
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {planFor.name} · {money(planFor.debt)} so'm
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                Bo'laklar soni
                <input
                  type="number"
                  min={2}
                  max={12}
                  value={planForm.parts}
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, parts: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Birinchi to'lov sanasi
                <input
                  type="date"
                  value={planForm.first_due_date}
                  onChange={(event) =>
                    setPlanForm((prev) => ({ ...prev, first_due_date: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={planForm.notify}
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, notify: event.target.checked }))}
                />
                Ota-onaga Telegram orqali grafikni yuborish
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPlanFor(null)}
                className="rounded-lg border border-border/60 px-4 py-2 text-sm"
              >
                Bekor
              </button>
              <button
                type="button"
                disabled={planMutation.isPending}
                onClick={() => planMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {planMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
