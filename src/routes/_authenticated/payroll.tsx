import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calculator, Loader2, Save, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { applyPayroll, getPayrollPreview } from "@/lib/payroll.functions";

export const Route = createFileRoute("/_authenticated/payroll")({
  beforeLoad: ({ context }) => {
    const roles = (context as { roles?: string[] }).roles ?? [];
    if (!roles.includes("admin") && !roles.includes("director")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: PayrollPage,
  head: () => ({
    meta: [
      { title: "Oylik hisob-kitobi · Akhmad Academy" },
      {
        name: "description",
        content:
          "O'quvchi soni va yig'ilgan to'lov asosida o'qituvchi oyligi, bonus va jarimalar avtomatik hisoblanadi.",
      },
      { property: "og:title", content: "Oylik hisob-kitobi · Akhmad Academy" },
      {
        property: "og:description",
        content: "KPI asosida o'qituvchi maoshini avtomatik hisoblash va saqlash.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const money = (value: number) => Number(value || 0).toLocaleString("uz-UZ");
const thisMonth = () => new Date().toISOString().slice(0, 7);

type Override = { percent: string; bonus: string; penalty: string; visible: boolean };

function PayrollPage() {
  const queryClient = useQueryClient();
  const fetchPreview = useServerFn(getPayrollPreview);
  const save = useServerFn(applyPayroll);
  const [period, setPeriod] = useState(thisMonth());
  const [overrides, setOverrides] = useState<Record<string, Override>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["payroll-preview", period],
    queryFn: () => fetchPreview({ data: { period_month: period } }),
    staleTime: 60_000,
  });

  const rows = data?.rows ?? [];

  useEffect(() => {
    setOverrides({});
  }, [period]);

  const overrideOf = (row: (typeof rows)[number]): Override =>
    overrides[row.teacher_user_id] ?? {
      percent: String(row.percent ?? 0),
      bonus: String(row.bonus ?? 0),
      penalty: String(row.penalty ?? 0),
      visible: true,
    };

  const setOverride = (id: string, patch: Partial<Override>, base: Override) =>
    setOverrides((prev) => ({ ...prev, [id]: { ...base, ...patch } }));

  const computed = useMemo(
    () =>
      rows.map((row) => {
        const o = overrideOf(row);
        const percent = Number(o.percent.replace(/[^\d.]/g, "")) || 0;
        const bonus = Number(o.bonus.replace(/\D/g, "")) || 0;
        const penalty = Number(o.penalty.replace(/\D/g, "")) || 0;
        const percentEarning = Math.round((row.collected_total * percent) / 100);
        return {
          ...row,
          percent,
          bonus,
          penalty,
          visible: o.visible,
          percent_earning: percentEarning,
          salary: Math.max(0, percentEarning + bonus - penalty),
        };
      }),
    [rows, overrides],
  );

  const totals = useMemo(
    () => ({
      students: computed.reduce((s, r) => s + r.students_count, 0),
      collected: computed.reduce((s, r) => s + r.collected_total, 0),
      salary: computed.reduce((s, r) => s + r.salary, 0),
    }),
    [computed],
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          period_month: period,
          rows: computed.map((row) => ({
            teacher_user_id: row.teacher_user_id,
            percent: row.percent,
            bonus: row.bonus,
            penalty: row.penalty,
            visible_to_teacher: row.visible,
          })),
        } as never,
      }),
    onSuccess: (result) => {
      toast.success(`${result.saved} o'qituvchi uchun oylik saqlandi`);
      queryClient.invalidateQueries({ queryKey: ["teacher-balance"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Oylik hisob-kitobi</h1>
          <p className="text-sm text-muted-foreground">
            KPI: o'quvchi soni × belgilangan summa. Oylik yig'ilgan to'lovdan foiz + bonus −
            jarima.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs">
            <span className="text-muted-foreground">Davr</span>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value || thisMonth())}
              className="mt-1 block rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={saveMutation.isPending || !computed.length}
            onClick={() => saveMutation.mutate()}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Saqlash
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={Users} label="O'qituvchi" value={String(computed.length)} />
        <Kpi icon={Users} label="O'quvchi" value={String(totals.students)} />
        <Kpi icon={Wallet} label="Yig'ilgan to'lov" value={`${money(totals.collected)} so'm`} />
        <Kpi icon={Calculator} label="Jami oylik" value={`${money(totals.salary)} so'm`} />
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Hisoblanmoqda...
        </p>
      ) : computed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Bu davr uchun o'qituvchi ma'lumoti topilmadi.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">O'qituvchi</th>
                <th className="px-3 py-2 text-right">O'quvchi</th>
                <th className="px-3 py-2 text-right">Kutilgan</th>
                <th className="px-3 py-2 text-right">Yig'ilgan</th>
                <th className="px-3 py-2 text-right">KPI</th>
                <th className="px-3 py-2 text-right">Foiz %</th>
                <th className="px-3 py-2 text-right">Bonus</th>
                <th className="px-3 py-2 text-right">Jarima</th>
                <th className="px-3 py-2 text-right">Oylik</th>
                <th className="px-3 py-2 text-center">Ko'rinsin</th>
              </tr>
            </thead>
            <tbody>
              {computed.map((row) => {
                const base = overrideOf(row);
                return (
                  <tr key={row.teacher_user_id} className="border-t border-border">
                    <td className="px-3 py-2 font-semibold">{row.teacher_name || "—"}</td>
                    <td className="px-3 py-2 text-right">{row.students_count}</td>
                    <td className="px-3 py-2 text-right">{money(row.expected_total)}</td>
                    <td className="px-3 py-2 text-right">{money(row.collected_total)}</td>
                    <td className="px-3 py-2 text-right">{row.kpi_score}%</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        value={base.percent}
                        onChange={(e) =>
                          setOverride(row.teacher_user_id, { percent: e.target.value }, base)
                        }
                        inputMode="decimal"
                        className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        value={base.bonus}
                        onChange={(e) =>
                          setOverride(row.teacher_user_id, { bonus: e.target.value }, base)
                        }
                        inputMode="numeric"
                        className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        value={base.penalty}
                        onChange={(e) =>
                          setOverride(row.teacher_user_id, { penalty: e.target.value }, base)
                        }
                        inputMode="numeric"
                        className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-extrabold">{money(row.salary)}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={base.visible}
                        onChange={(e) =>
                          setOverride(row.teacher_user_id, { visible: e.target.checked }, base)
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 text-xl font-extrabold">{value}</div>
    </div>
  );
}
