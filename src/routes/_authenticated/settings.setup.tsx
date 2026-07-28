import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Check, Circle, RefreshCw, ArrowRight } from "lucide-react";
import { getSetupStatus, type SetupStep } from "@/lib/setup.functions";

export const Route = createFileRoute("/_authenticated/settings/setup")({
  component: SetupPage,
});

function SetupPage() {
  const [steps, setSteps] = useState<SetupStep[] | null>(null);
  const [percent, setPercent] = useState(0);
  const [done, setDone] = useState(0);
  const [required, setRequired] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getSetupStatus();
      setSteps(s.steps as SetupStep[]);
      setPercent(s.percent);
      setDone(s.doneCount);
      setRequired(s.requiredCount);
    } catch {
      setSteps([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">Tizimni ishga tushirish</h2>
            <p className="text-sm text-muted-foreground">
              Quyidagi qadamlar bajarilgach CRM to'liq ishlaydi: to'lov, davomat, hisobot va Telegram avtomatikasi.
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Yangilash
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
          <span className="text-sm font-bold text-primary">
            {percent}% ({done}/{required})
          </span>
        </div>
      </div>

      {loading && !steps && <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>}

      <div className="grid gap-3">
        {(steps ?? []).map((s, i) => (
          <Link
            key={s.key}
            to={s.to}
            className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
          >
            <span
              className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                s.done ? "bg-emerald-500/15 text-emerald-600" : "bg-secondary text-muted-foreground"
              }`}
            >
              {s.done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">{s.title}</span>
                {s.optional && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Ixtiyoriy
                  </span>
                )}
                {s.done ? (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                    Bajarildi{s.count > 1 ? ` · ${s.count}` : ""}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                    <Circle className="h-2 w-2 fill-current" /> Bajarilmagan
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </div>
  );
}
