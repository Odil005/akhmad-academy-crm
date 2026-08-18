import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, ChevronRight, Circle, GraduationCap, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  TOUR_STEPS,
  TOUR_TASKS,
  resolveTourRole,
  type TourRole,
  type TourStep,
} from "@/lib/tour-steps";

type TourApi = {
  role: TourRole;
  steps: TourStep[];
  running: boolean;
  /** Turni boshlash. index berilsa shu qadamdan boshlanadi. */
  start: (index?: number) => void;
  /** target (data-tour qiymati) bo'yicha qadamni topib ko'rsatish. */
  startAtTarget: (target: string) => boolean;
  stop: () => void;
  doneTasks: string[];
  toggleTask: (key: string) => void;
  progress: number;
  openChecklist: () => void;
};

const TourContext = createContext<TourApi | null>(null);

export function useTour(): TourApi {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside <TourProvider>");
  return ctx;
}

type Rect = { top: number; left: number; width: number; height: number };

export function TourProvider({
  userId,
  roles,
  children,
}: {
  userId: string;
  roles: string[];
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const role = useMemo(() => resolveTourRole(roles), [roles]);
  const steps = TOUR_STEPS[role];
  const tasks = TOUR_TASKS[role];

  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [doneTasks, setDoneTasks] = useState<string[]>([]);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const loadedRef = useRef(false);
  const db = supabase as unknown as {
    from: (table: string) => any;
  };

  // Saqlangan holatni yuklash; birinchi kirishda turni avtomatik boshlash.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await db
        .from("onboarding_progress")
        .select("last_step, completed, done_tasks")
        .eq("user_id", userId)
        .eq("tour_key", "main")
        .maybeSingle();
      if (cancelled) return;
      loadedRef.current = true;
      if (!data) {
        setIndex(0);
        setRunning(true);
        return;
      }
      setDoneTasks(Array.isArray(data.done_tasks) ? data.done_tasks : []);
      if (!data.completed) {
        setIndex(Math.min(Number(data.last_step) || 0, steps.length - 1));
        setRunning(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, steps.length, userId]);

  const persist = useCallback(
    (patch: Record<string, unknown>) => {
      if (!loadedRef.current) return;
      void db
        .from("onboarding_progress")
        .upsert(
          {
            user_id: userId,
            role,
            tour_key: "main",
            updated_at: new Date().toISOString(),
            ...patch,
          },
          { onConflict: "user_id,tour_key" },
        )
        .then(() => undefined);
    },
    [db, role, userId],
  );

  const step = running ? steps[index] : undefined;

  // Nishonni topib, spotlight koordinatalarini hisoblash.
  useEffect(() => {
    if (!step) {
      setRect(null);
      return;
    }
    if (step.to) {
      try {
        navigate({ to: step.to });
      } catch {
        /* ignore */
      }
    }
    if (!step.target) {
      setRect(null);
      return;
    }
    let frame = 0;
    let attempts = 0;
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
          return;
        }
      }
      attempts += 1;
      if (attempts < 40) frame = window.requestAnimationFrame(measure);
      else setRect(null);
    };
    measure();
    const onChange = () => measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [navigate, step]);

  const start = useCallback(
    (at = 0) => {
      setIndex(Math.max(0, Math.min(at, steps.length - 1)));
      setRunning(true);
      setChecklistOpen(false);
      persist({ last_step: at, completed: false });
    },
    [persist, steps.length],
  );

  const startAtTarget = useCallback(
    (target: string) => {
      const at = steps.findIndex((s) => s.target === target || s.to === target);
      if (at < 0) return false;
      start(at);
      return true;
    },
    [start, steps],
  );

  const stop = useCallback(() => {
    setRunning(false);
    persist({ last_step: index, completed: true });
  }, [index, persist]);

  const next = useCallback(() => {
    if (index >= steps.length - 1) {
      setRunning(false);
      setChecklistOpen(true);
      persist({ last_step: steps.length - 1, completed: true });
      return;
    }
    const at = index + 1;
    setIndex(at);
    persist({ last_step: at, completed: false });
  }, [index, persist, steps.length]);

  const prev = useCallback(() => {
    const at = Math.max(0, index - 1);
    setIndex(at);
    persist({ last_step: at, completed: false });
  }, [index, persist]);

  const toggleTask = useCallback(
    (key: string) => {
      setDoneTasks((current) => {
        const nextTasks = current.includes(key)
          ? current.filter((item) => item !== key)
          : [...current, key];
        persist({ done_tasks: nextTasks });
        return nextTasks;
      });
    },
    [persist],
  );

  const progress = tasks.length
    ? Math.round((doneTasks.filter((k) => tasks.some((t) => t.key === k)).length / tasks.length) * 100)
    : 0;

  const api = useMemo<TourApi>(
    () => ({
      role,
      steps,
      running,
      start,
      startAtTarget,
      stop,
      doneTasks,
      toggleTask,
      progress,
      openChecklist: () => setChecklistOpen(true),
    }),
    [doneTasks, progress, role, running, start, startAtTarget, steps, stop, toggleTask],
  );

  const tooltipStyle = useMemo<React.CSSProperties>(() => {
    const width = 320;
    if (!rect) {
      return {
        width,
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };
    }
    const gap = 14;
    const viewportW = typeof window === "undefined" ? 1280 : window.innerWidth;
    const viewportH = typeof window === "undefined" ? 800 : window.innerHeight;
    let left = rect.left + rect.width + gap;
    if (left + width > viewportW - 12) left = Math.max(12, rect.left - width - gap);
    if (left < 12) left = 12;
    let top = rect.top;
    if (top + 240 > viewportH) top = Math.max(12, viewportH - 250);
    return { width, left, top };
  }, [rect]);

  return (
    <TourContext.Provider value={api}>
      {children}

      {running && step && (
        <div className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-foreground/60 backdrop-blur-[1px]" onClick={stop} />
          {rect && (
            <div
              className="pointer-events-none absolute rounded-xl ring-4 ring-primary"
              style={{
                top: rect.top - 6,
                left: rect.left - 6,
                width: rect.width + 12,
                height: rect.height + 12,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
              }}
            />
          )}
          <div
            className="absolute rounded-2xl border border-primary/40 bg-card p-4 shadow-2xl"
            style={tooltipStyle}
          >
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary">
              <GraduationCap className="h-3.5 w-3.5" />
              {index + 1} / {steps.length}
              <button onClick={stop} className="ml-auto text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <h3 className="text-base font-extrabold">{step.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
            <div className="mt-4 flex items-center gap-2">
              {index > 0 && (
                <button
                  onClick={prev}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  Orqaga
                </button>
              )}
              <button
                onClick={stop}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Yopish
              </button>
              <button
                onClick={next}
                className="ml-auto inline-flex items-center gap-1 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground"
              >
                {index >= steps.length - 1 ? "Tugatish" : "Keyingi"}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {checklistOpen && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center p-4 md:items-center">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setChecklistOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold">Boshlash vazifalari</h3>
              <button
                onClick={() => setChecklistOpen(false)}
                className="ml-auto rounded-lg border border-border p-1.5 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Bajarilgan: {progress}% — vazifani bosib kerakli bo'limga o'tasiz.
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <ul className="mt-4 space-y-2">
              {tasks.map((task) => {
                const done = doneTasks.includes(task.key);
                return (
                  <li key={task.key} className="flex items-center gap-2">
                    <button
                      onClick={() => toggleTask(task.key)}
                      className="text-primary"
                      title={done ? "Bajarilmagan deb belgilash" : "Bajarildi deb belgilash"}
                    >
                      {done ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setChecklistOpen(false);
                        try {
                          navigate({ to: task.to });
                        } catch {
                          /* ignore */
                        }
                      }}
                      className={`flex-1 rounded-lg border border-border px-3 py-2 text-left text-sm transition hover:border-primary ${
                        done ? "text-muted-foreground line-through" : "font-medium"
                      }`}
                    >
                      {task.label}
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              onClick={() => start(0)}
              className="mt-4 w-full rounded-xl border border-primary/40 px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary/10"
            >
              Turni qaytadan ko'rish
            </button>
          </div>
        </div>
      )}
    </TourContext.Provider>
  );
}
