import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Rocket, ArrowRight } from "lucide-react";
import { getSetupStatus } from "@/lib/setup.functions";

export function SetupBanner() {
  const [state, setState] = useState<{ percent: number; doneCount: number; requiredCount: number; next: string | null } | null>(null);

  useEffect(() => {
    let alive = true;
    getSetupStatus()
      .then((s) => {
        if (!alive) return;
        const next = s.steps.find((x) => !x.optional && !x.done)?.title ?? null;
        setState({ percent: s.percent, doneCount: s.doneCount, requiredCount: s.requiredCount, next });
      })
      .catch(() => setState(null));
    return () => {
      alive = false;
    };
  }, []);

  if (!state || state.percent >= 100) return null;

  return (
    <Link
      to="/settings/setup"
      className="group flex flex-wrap items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Rocket className="h-5 w-5" />
      </span>
      <div className="min-w-[200px] flex-1">
        <div className="text-sm font-bold">
          Tizim {state.percent}% sozlangan ({state.doneCount}/{state.requiredCount})
        </div>
        <div className="text-xs text-muted-foreground">
          {state.next ? `Keyingi qadam: ${state.next}` : "Sozlashni yakunlang"}
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${state.percent}%` }} />
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        Sozlash <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
