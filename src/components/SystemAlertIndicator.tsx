import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SystemAlertSnapshot } from "@/features/system-alerts/types";
import { getSystemAlerts } from "@/lib/system-alerts.functions";
import { useLanguage } from "@/lib/i18n";


const POLL_INTERVAL_MS = 120_000;
const SOUND_KEY = "akhmad.alert.sound";
const VOLUME_KEY = "akhmad.alert.volume";

/** Baland, uch marta takrorlanadigan ogohlantirish signali (WebAudio — fayl kerak emas). */
function playAlertBeep(volume = 1) {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    void ctx.resume?.().catch(() => {});
    const master = ctx.createGain();
    master.gain.value = Math.min(1, Math.max(0.1, volume));
    // Yumshoq cheklovchi — baland ovozda ham buzilmasin.
    const limiter = ctx.createDynamicsCompressor();
    master.connect(limiter).connect(ctx.destination);

    const beep = (at: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.3);
      osc.connect(gain).connect(master);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.32);
    };
    // 3 marta ketma-ket ikki tonli signal — e'tibordan chetda qolmaydi.
    for (let i = 0; i < 3; i += 1) {
      beep(i * 0.72, 1180);
      beep(i * 0.72 + 0.34, 880);
    }
    window.setTimeout(() => void ctx.close().catch(() => {}), 3200);
  } catch {
    /* sound is a nicety — never break the indicator */
  }
}


function connectionFailureSnapshot(): SystemAlertSnapshot {
  const checkedAt = new Date().toISOString();
  return {
    alerts: [
      {
        id: "system:connection",
        kind: "system",
        severity: "critical",
        title: "Tizim tekshiruvida xato",
        detail: "Server yoki ma'lumotlar bazasi bilan aloqani tekshiring",
        count: 1,
        actionLabel: "Sozlamalarni ochish",
        actionPath: "/settings/integrations",
        createdAt: checkedAt,
      },
    ],
    totalCount: 1,
    criticalCount: 1,
    checkedAt,
  };
}

export function SystemAlertIndicator() {
  const [snapshot, setSnapshot] = useState<SystemAlertSnapshot | null>(null);
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [volume, setVolume] = useState(1);
  const lastSignature = useRef<string | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    setSoundOn(window.localStorage.getItem(SOUND_KEY) !== "off");
    const stored = Number(window.localStorage.getItem(VOLUME_KEY));
    if (Number.isFinite(stored) && stored > 0) setVolume(Math.min(1, stored));
  }, []);


  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setSnapshot(await getSystemAlerts());
    } catch {
      setSnapshot(connectionFailureSnapshot());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  const count = snapshot?.totalCount ?? 0;
  const hasCritical = (snapshot?.criticalCount ?? 0) > 0;

  // Beep once whenever a new problem appears (not on every 2-minute recheck).
  useEffect(() => {
    if (!snapshot) return;
    const signature = snapshot.alerts.map((alert) => `${alert.id}:${alert.count}`).join("|");
    const previous = lastSignature.current;
    lastSignature.current = signature;
    if (previous === null || signature === previous || signature === "") return;
    const isNew = signature.split("|").some((item) => !previous.split("|").includes(item));
    if (isNew && soundOn) playAlertBeep();
  }, [snapshot, soundOn]);

  const toggleSound = () => {
    setSoundOn((value) => {
      const next = !value;
      window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
      if (next) playAlertBeep();
      return next;
    });
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void refresh();
        }}
        className={`relative rounded-xl border p-2.5 transition ${
          count > 0
            ? hasCritical
              ? "border-red-400/60 bg-red-500/10 text-red-600 hover:bg-red-500/15"
              : "border-amber-400/60 bg-amber-500/10 text-amber-600 hover:bg-amber-500/15"
            : "border-border text-foreground/70 hover:bg-secondary"
        }`}
        aria-label={`Tizim ogohlantirishlari: ${count}`}
        aria-expanded={open}
        title={count ? `${count} ta muammo aniqlandi` : "Tizimda muammo aniqlanmadi"}
      >
        <BellRing className={`h-4 w-4 ${count > 0 ? "animate-pulse" : ""}`} />
        {count > 0 && (
          <span
            className={`absolute -right-2 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-extrabold text-white shadow ${
              hasCritical ? "bg-red-600" : "bg-amber-500"
            }`}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <section className="absolute right-0 top-full z-50 mt-2 w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <header className="flex items-center gap-3 border-b border-border px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-extrabold">Tizim ogohlantirishlari</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Administrator uchun avtomatik nazorat
              </p>
            </div>
            <button
              type="button"
              onClick={toggleSound}
              className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-muted"
              title={soundOn ? "Ovozli signal yoniq" : "Ovozli signal o'chirilgan"}
            >
              {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-muted disabled:opacity-50"
              title="Qayta tekshirish"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </header>

          <div className="max-h-[430px] overflow-y-auto p-2">
            {!snapshot ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" /> Tekshirilmoqda...
              </div>
            ) : snapshot.alerts.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
                <div className="mt-3 text-sm font-bold">Hammasi joyida</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tizimda administrator aralashuvi kerak bo'lgan muammo yo'q.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {snapshot.alerts.map((alert) => {
                  const critical = alert.severity === "critical";
                  return (
                    <Link
                      key={alert.id}
                      to={alert.actionPath as never}
                      onClick={() => setOpen(false)}
                      className={`group flex gap-3 rounded-xl border p-3 transition ${
                        critical
                          ? "border-red-300/60 bg-red-500/[0.06] hover:bg-red-500/10"
                          : "border-amber-300/60 bg-amber-500/[0.06] hover:bg-amber-500/10"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                          critical ? "bg-red-500/15 text-red-600" : "bg-amber-500/15 text-amber-600"
                        }`}
                      >
                        {alert.kind === "system" ? (
                          <WifiOff className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-extrabold">{alert.title}</span>
                        <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                          {alert.detail}
                        </span>
                        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                          {alert.actionLabel}
                          <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <footer className="border-t border-border px-4 py-2.5 text-center text-[10px] text-muted-foreground">
            Har 2 daqiqada tekshiriladi · yangi nosozlikda ovozli signal · xavfsiz navbatlarni Jarvis avtomatik tiklaydi
          </footer>
        </section>
      )}
    </div>
  );
}
