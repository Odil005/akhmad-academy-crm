import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, Send, X } from "lucide-react";

type Msg = { from: "bot" | "me"; text: string; buttons?: string[] };
type Step = { caption: string; msgs: Msg[] };

const STEPS: Step[] = [
  { caption: "1. Telegramda @AkhmadAcademylifebot ni oching va «Start» ni bosing", msgs: [
    { from: "me", text: "/start" },
    { from: "bot", text: "Assalomu alaykum! Akhmad Academy botiga xush kelibsiz. Farzandingizni topish uchun telefon raqamingizni yuboring.", buttons: ["📱 Raqamni yuborish"] },
  ] },
  { caption: "2. «Raqamni yuborish» tugmasini bosing — markazda yozilgan raqam bo'lishi kerak", msgs: [
    { from: "me", text: "📱 +998 90 123 45 67" },
    { from: "bot", text: "✅ Topildi! Farzandingiz: Karimov Alisher (Ingliz tili, Juft 14:00).", buttons: ["📅 Davomat", "⭐ Baholar", "💳 To'lovlar"] },
  ] },
  { caption: "3. Menyudan davomat, baholar va to'lovlarni ko'ring", msgs: [
    { from: "me", text: "📅 Davomat" },
    { from: "bot", text: "Noyabr: 11 darsdan 10 tasiga keldi ✅\nOxirgi dars: 25-noyabr — keldi" },
  ] },
  { caption: "4. Har darsdan keyin xabar avtomatik keladi — hech narsa bosish shart emas", msgs: [
    { from: "bot", text: "🔔 Alisher bugun darsga keldi (14:02).\n⭐ Bugungi baho: 5" },
    { from: "bot", text: "💳 To'lov qabul qilindi: 450 000 so'm (Noyabr). Rahmat!" },
  ] },
  { caption: "5. Saytda «Ota-ona» kabinetiga raqam + Telegramga kelgan kod bilan kirasiz", msgs: [
    { from: "bot", text: "🔐 Kabinetga kirish kodi: 4 8 2 1 9 7\nKodni hech kimga bermang." },
  ] },
];

const STEP_MS = 5200;

export function ParentBotDemo({ onClose, inline }: { onClose?: () => void; inline?: boolean }) {
  const [step, setStep] = useState(0);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setT((x) => x + 100), 100);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => {
    const cur = STEPS[step]!;
    const per = STEP_MS / (cur.msgs.length + 1);
    setShown(Math.min(cur.msgs.length, Math.floor(t / per)));
    if (t >= STEP_MS) {
      if (step < STEPS.length - 1) { setStep(step + 1); setT(0); }
      else if (inline) { setStep(0); setT(0); }
      else setPlaying(false);
    }
  }, [t, step]);

  useEffect(() => {
    if (!onClose) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const history = STEPS.slice(0, step).flatMap((s) => s.msgs).slice(-3);
  const visible = [...history, ...STEPS[step]!.msgs.slice(0, shown)];
  const restart = () => { setStep(0); setT(0); setShown(0); setPlaying(true); };
  const progress = (step + Math.min(1, t / STEP_MS)) / STEPS.length;

  if (inline) {
    return (
      <div className="mx-auto flex h-[420px] w-full max-w-[250px] flex-col overflow-hidden rounded-[2rem] border-4 border-primary-foreground/20 bg-muted" aria-label="Ota-onalar uchun Telegram bot namoyishi">
        <div className="flex items-center gap-2 bg-primary px-3 py-3 text-primary-foreground">
          <img src="/logo.png?v=akhmad-20261019" alt="" className="h-8 w-8 rounded-full" />
          <div className="leading-tight"><div className="text-xs font-semibold">Akhmad Academy</div><div className="text-[10px] opacity-70">bot</div></div>
        </div>
        <div className="bg-accent/90 px-3 py-1.5 text-[10px] font-semibold text-primary">{STEPS[step]!.caption}</div>
        <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden p-3">
          {visible.map((m, i) => (
            <div key={`${step}-${i}-${m.text}`} className={`chat-pop max-w-[85%] ${m.from === "me" ? "self-end" : "self-start"}`}>
              <div className={`whitespace-pre-line rounded-2xl px-3 py-2 text-[11px] leading-snug shadow-sm ${m.from === "me" ? "rounded-br-sm bg-accent text-primary" : "rounded-bl-sm bg-background text-foreground"}`}>{m.text}</div>
            </div>
          ))}
        </div>
        <style>{`@keyframes chatpop{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}.chat-pop{animation:chatpop .35s ease-out both}`}</style>
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Ota-onalar uchun Telegram bot — qanday ishlaydi" className="fixed inset-0 z-50 flex items-center justify-center bg-primary/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Yopish" className="absolute right-4 top-4 z-10 rounded-full bg-muted p-2"><X className="h-4 w-4" /></button>
        <div className="grid md:grid-cols-[1fr_300px]">
          <div className="flex flex-col justify-between p-8">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">Video qo'llanma</span>
              <h3 className="mt-3 font-display text-3xl text-primary">Ota-onalar uchun Telegram bot</h3>
              <ol className="mt-6 space-y-2">
                {STEPS.map((s, i) => (
                  <li key={i}>
                    <button onClick={() => { setStep(i); setT(0); setPlaying(true); }} className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${i === step ? "bg-accent/20 font-semibold text-primary" : i < step ? "text-foreground/70" : "text-muted-foreground"}`}>
                      {s.caption}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <div className="mt-6">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-accent transition-[width] duration-100" style={{ width: `${progress * 100}%` }} /></div>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => (playing ? setPlaying(false) : step === STEPS.length - 1 && t >= STEP_MS ? restart() : setPlaying(true))} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
                  {playing ? <><Pause className="h-3.5 w-3.5" /> Pauza</> : <><Play className="h-3.5 w-3.5" /> Davom ettirish</>}
                </button>
                <button onClick={restart} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold"><RotateCcw className="h-3.5 w-3.5" /> Qaytadan</button>
                <a href="https://t.me/AkhmadAcademylifebot" target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-primary"><Send className="h-3.5 w-3.5" /> Botni ochish</a>
              </div>
            </div>
          </div>
          <div className="bg-primary p-6">
            <div className="mx-auto flex h-[520px] w-full max-w-[260px] flex-col overflow-hidden rounded-[2rem] border-4 border-primary-foreground/20 bg-muted">
              <div className="flex items-center gap-2 bg-primary px-3 py-3 text-primary-foreground">
                <img src="/logo.png?v=akhmad-20261019" alt="" className="h-8 w-8 rounded-full" />
                <div className="leading-tight"><div className="text-xs font-semibold">Akhmad Academy</div><div className="text-[10px] opacity-70">bot</div></div>
              </div>
              <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden p-3">
                {visible.map((m, i) => (
                  <div key={`${step}-${i}-${m.text}`} className={`chat-pop max-w-[85%] ${m.from === "me" ? "self-end" : "self-start"}`}>
                    <div className={`whitespace-pre-line rounded-2xl px-3 py-2 text-[11px] leading-snug shadow-sm ${m.from === "me" ? "rounded-br-sm bg-accent text-primary" : "rounded-bl-sm bg-background text-foreground"}`}>{m.text}</div>
                    {m.buttons && (
                      <div className="mt-1 grid gap-1">{m.buttons.map((b) => <div key={b} className="rounded-lg bg-background/80 px-2 py-1 text-center text-[10px] font-semibold text-primary">{b}</div>)}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes chatpop{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}.chat-pop{animation:chatpop .35s ease-out both}`}</style>
    </div>
  );
}
