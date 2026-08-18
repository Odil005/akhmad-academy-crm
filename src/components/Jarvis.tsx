import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { contextualSuggestions, findHowTo, formatHowTo } from "@/lib/guide-help";
import { useTour } from "@/components/tour/TourProvider";
import { Bot, Mic, MicOff, RotateCcw, Send, X, Loader2, Volume2, VolumeX } from "lucide-react";
import { jarvisChat, jarvisTranscribe, jarvisSpeak } from "@/lib/jarvis.functions";

type RouteIntent = { to: string; label: string; keywords: string[] };

const ROUTE_MAP: RouteIntent[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    keywords: ["dashboard", "bosh sahifa", "statistika", "umumiy", "panel"],
  },
  { to: "/students", label: "O'quvchilar", keywords: ["o'quvchi", "oquvchi", "talaba", "student"] },
  { to: "/groups", label: "Guruhlar", keywords: ["guruh", "sinf", "group"] },
  {
    to: "/schedule",
    label: "Dars jadvali",
    keywords: ["jadval", "dars jadval", "schedule", "raspisaniya"],
  },
  {
    to: "/attendance",
    label: "Davomat",
    keywords: ["davomat", "kelmagan", "yo'q", "yoq", "attendance"],
  },
  { to: "/rooms", label: "Xonalar", keywords: ["xona", "auditoriya", "room"] },
  {
    to: "/payments",
    label: "To'lovlar",
    keywords: ["to'lov", "tolov", "payment", "pul kelgan", "kim to'ladi"],
  },
  {
    to: "/finance",
    label: "Moliya",
    keywords: ["moliya", "daromad", "xarajat", "foyda", "finance", "kassa", "balans"],
  },
  { to: "/leads", label: "Lidlar", keywords: ["lid", "lead", "mijoz", "yangi mijoz"] },
  {
    to: "/behavior",
    label: "Dars faolligi",
    keywords: ["faollik", "ishtirok", "xulq", "behavior", "intizom"],
  },
  { to: "/messages", label: "Xabarlar", keywords: ["xabar", "message", "yozishma", "chat"] },
  {
    to: "/marketplace",
    label: "Marketplace",
    keywords: ["market", "do'kon", "dokon", "mahsulot", "sotib"],
  },
  {
    to: "/teacher-balance",
    label: "O'qituvchi balansi",
    keywords: ["o'qituvchi balan", "oqituvchi balan", "oylik", "salary", "maosh"],
  },
  { to: "/calls", label: "Qo'ng'iroqlar", keywords: ["qo'ng'iroq", "qongiroq", "call", "telefon"] },
  { to: "/face-id", label: "Face ID", keywords: ["face", "yuz", "face id"] },
  { to: "/reports", label: "Hisobotlar", keywords: ["hisobot", "report", "otchet"] },
  { to: "/import", label: "Excel import", keywords: ["import", "excel", "yuklash"] },
  { to: "/search", label: "Qidiruv", keywords: ["qidir", "search", "topish"] },
  {
    to: "/methodology",
    label: "Metodika",
    keywords: ["metodika", "darslik", "kitob", "qo'llanma", "qollanma", "methodology"],
  },
  { to: "/settings", label: "Sozlamalar", keywords: ["sozlama", "setting", "konfig"] },

  {
    to: "/teacher-panel",
    label: "O'qituvchi paneli",
    keywords: ["o'qituvchi panel", "oqituvchi panel", "teacher panel"],
  },
];

function detectRoute(text: string): RouteIntent | null {
  const t = text.toLowerCase();
  let best: { intent: RouteIntent; score: number } | null = null;
  for (const intent of ROUTE_MAP) {
    for (const k of intent.keywords) {
      if (t.includes(k)) {
        const score = k.length;
        if (!best || score > best.score) best = { intent, score };
      }
    }
  }
  return best?.intent ?? null;
}

type MsgAction = { label: string; to: string; tourTarget?: string };
type Msg = { role: "user" | "assistant"; content: string; action?: MsgAction };

const CHAT_STORAGE_KEY = "unicrm:jarvis:conversation";
const WELCOME_MESSAGE: Msg = {
  role: "assistant",
  content:
    "Assalomu alaykum! Men Jarvisman. Siz bilan oddiy suhbatlashaman, savollaringizni tushuntiraman va ruxsatingiz doirasida CRM ishlarini ham bajaraman. Bugun nimadan boshlaymiz?",
};

export function Jarvis() {
  const chat = useServerFn(jarvisChat);
  const transcribe = useServerFn(jarvisTranscribe);
  const speak = useServerFn(jarvisSpeak);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { role, startAtTarget, start } = useTour();
  const suggestions = useMemo(() => contextualSuggestions(pathname, role), [pathname, role]);

  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME_MESSAGE]);
  const [historyReady, setHistoryReady] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechRequestRef = useRef(0);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(CHAT_STORAGE_KEY);
      const parsed = stored ? (JSON.parse(stored) as unknown) : null;
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(
          (message) =>
            typeof message === "object" &&
            message !== null &&
            ["user", "assistant"].includes(String((message as Msg).role)) &&
            typeof (message as Msg).content === "string",
        )
      ) {
        setMsgs((parsed as Msg[]).slice(-40));
      }
    } catch {
      sessionStorage.removeItem(CHAT_STORAGE_KEY);
    } finally {
      setHistoryReady(true);
    }
  }, []);

  useEffect(() => {
    if (!historyReady) return;
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(msgs.slice(-40)));
  }, [historyReady, msgs]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  useEffect(
    () => () => {
      speechRequestRef.current += 1;
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [],
  );

  const stopSpeaking = () => {
    speechRequestRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  };

  const speakOut = async (text: string) => {
    if (!voiceOn || !text) return;
    stopSpeaking();
    const requestId = speechRequestRef.current;
    try {
      const r = await speak({ data: { text } });
      if (requestId !== speechRequestRef.current) return;

      const src = base64ToObjectUrl(r.audio_base64, r.mime);
      if (requestId !== speechRequestRef.current) {
        URL.revokeObjectURL(src);
        return;
      }
      const a = new Audio(src);
      a.preload = "auto";
      a.playbackRate = 1;
      a.preservesPitch = true;
      audioRef.current = a;
      audioUrlRef.current = src;
      const releaseAudio = () => {
        if (audioRef.current === a) audioRef.current = null;
        if (audioUrlRef.current === src) {
          URL.revokeObjectURL(src);
          audioUrlRef.current = null;
        }
      };
      a.onended = releaseAudio;
      a.onerror = () => releaseAudio();
      await a.play();
    } catch {
      /* ignore */
    }
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next);

    // O'rgatuvchi rejim: "qanday qilaman?" savoliga darhol qadamli javob.
    const howTo = findHowTo(q, role);
    if (howTo) {
      const reply = formatHowTo(howTo);
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: reply,
          action: { label: "Ko'rsatib ber", to: howTo.to, tourTarget: howTo.tourTarget },
        },
      ]);
      void speakOut(`${howTo.title}. ${howTo.steps.join(". ")}`);
      return;
    }

    // Instant navigation — skip AI round-trip when the intent is clear.
    const intent = detectRoute(q);
    const needsAnswer = /(bormi|qancha|necha|kim|qanday|tekshir|tahlil|yubor|tuzat)/i.test(q);
    if (intent && !needsAnswer) {
      const reply = `🧭 "${intent.label}" bo'limi ochildi.`;
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
      try {
        navigate({ to: intent.to });
      } catch {
        /* ignore */
      }
      // Fire TTS in background, do not await.
      void speakOut(reply);
      return;
    }

    setBusy(true);
    try {
      const r = await chat({
        data: { messages: next.map((m) => ({ role: m.role, content: m.content })) },
      });
      const reply = r.reply || "Javobni olishda uzilish bo'ldi. Iltimos, bir marta qayta yuboring.";
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
      if (r.navigate) {
        try {
          navigate({ to: r.navigate });
        } catch {
          /* ignore */
        }
      }
      void speakOut(reply);
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Hozir javob xizmatiga ulanishda uzilish bo'ldi. “Xabar bormi?” yoki “Tizimni tekshir” buyrug'ini sinab ko'ring.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const startRec = async () => {
    if (recording || busy) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size < 800) return;
        setBusy(true);
        try {
          const b64 = await blobToBase64(blob);
          const t = await transcribe({ data: { audio_base64: b64, mime: blob.type } });
          if (t.text?.trim()) await send(t.text);
        } catch {
          setMsgs((m) => [
            ...m,
            {
              role: "assistant",
              content: "Ovozli xizmat hozircha faol emas. Savolingizni yozib yuboring.",
            },
          ]);
        } finally {
          setBusy(false);
        }
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      alert("Mikrofonga ruxsat kerak");
    }
  };

  const stopRec = () => {
    if (!recording) return;
    mediaRef.current?.stop();
    setRecording(false);
  };

  const clearConversation = () => {
    stopSpeaking();
    sessionStorage.removeItem(CHAT_STORAGE_KEY);
    setMsgs([WELCOME_MESSAGE]);
  };

  const toggleVoice = () => {
    if (voiceOn) {
      stopSpeaking();
      setVoiceOn(false);
      return;
    }
    setVoiceOn(true);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          data-tour="jarvis-button"
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-2xl shadow-primary/40 transition hover:scale-105"
          title="Jarvis"
        >
          <Bot className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 h-3 w-3 animate-ping rounded-full bg-emerald-400" />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[600px] max-h-[85vh] w-[380px] max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-primary/15 to-transparent px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">Jarvis</div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500">
                Tayyor · O'rgatuvchi va boshqaruv yordamchisi
              </div>
            </div>
            <button
              onClick={clearConversation}
              disabled={busy}
              className="rounded-lg border border-border p-1.5 hover:bg-muted disabled:opacity-50"
              title="Yangi suhbat"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={toggleVoice}
              className="rounded-lg border border-border p-1.5 hover:bg-muted"
              title={voiceOn ? "Ovozni o'chirish" : "Ovozni yoqish"}
            >
              {voiceOn ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-border p-1.5 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.content}
                  {m.action && (
                    <button
                      onClick={() => {
                        const action = m.action!;
                        try {
                          navigate({ to: action.to });
                        } catch {
                          /* ignore */
                        }
                        if (action.tourTarget) {
                          window.setTimeout(() => {
                            if (!startAtTarget(action.tourTarget!)) start(0);
                          }, 350);
                        }
                      }}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                    >
                      {m.action.label}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Jarvis o'ylayapti...
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <button
                onClick={recording ? stopRec : startRec}
                disabled={busy && !recording}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                  recording
                    ? "animate-pulse bg-destructive text-destructive-foreground"
                    : "border border-border bg-background hover:border-primary hover:text-primary"
                }`}
                title={recording ? "To'xtatish" : "Ovozli savol"}
              >
                {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder={recording ? "Gapiring..." : "Savolingizni yozing..."}
                rows={1}
                className="max-h-24 min-h-[40px] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <button
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={busy}
                  className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function base64ToObjectUrl(base64: string, mime: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}
