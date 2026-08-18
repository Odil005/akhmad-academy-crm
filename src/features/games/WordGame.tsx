import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Lightbulb, RefreshCw, SpellCheck2, Timer, Trophy } from "lucide-react";

type WordItem = { word: string; hint: string };

const WORDS: Record<string, WordItem[]> = {
  "Ingliz tili": [
    { word: "teacher", hint: "O'qituvchi" },
    { word: "library", hint: "Kutubxona" },
    { word: "student", hint: "O'quvchi" },
    { word: "knowledge", hint: "Bilim" },
    { word: "homework", hint: "Uyga vazifa" },
    { word: "science", hint: "Fan" },
    { word: "future", hint: "Kelajak" },
    { word: "success", hint: "Muvaffaqiyat" },
  ],
  "Ona tili": [
    { word: "kitob", hint: "O'qish uchun manba" },
    { word: "maktab", hint: "Ta'lim muassasasi" },
    { word: "daftar", hint: "Yozuv uchun" },
    { word: "bilim", hint: "O'rganilgan narsa" },
    { word: "ustoz", hint: "Murabbiy" },
    { word: "hikoya", hint: "Qisqa asar" },
  ],
  Matematika: [
    { word: "kvadrat", hint: "To'rt teng tomonli shakl" },
    { word: "kasr", hint: "Butunning bo'lagi" },
    { word: "burchak", hint: "Ikki nur orasidagi" },
    { word: "tenglama", hint: "Noma'lumli ifoda" },
    { word: "daraja", hint: "Ko'paytmaning qisqa yozuvi" },
  ],
};

const TOPICS = Object.keys(WORDS);

function scramble(word: string): string {
  const letters = word.split("");
  for (let i = letters.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j]!, letters[i]!];
  }
  const joined = letters.join("");
  return joined === word && word.length > 2 ? scramble(word) : joined;
}

export default function WordGame() {
  const [topic, setTopic] = useState(TOPICS[0]!);
  const pool = useMemo(() => WORDS[topic] ?? [], [topic]);
  const [round, setRound] = useState(0);
  const [scrambled, setScrambled] = useState("");
  const [guess, setGuess] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [seconds, setSeconds] = useState(45);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");

  const item = pool[round % Math.max(pool.length, 1)];

  const nextRound = useCallback(
    (increment: boolean) => {
      setRound((r) => (increment ? r + 1 : r));
      setGuess("");
      setShowHint(false);
      setSeconds(45);
      setStatus("playing");
    },
    [],
  );

  useEffect(() => {
    if (item) setScrambled(scramble(item.word));
  }, [item]);

  useEffect(() => {
    setRound(0);
    setGuess("");
    setShowHint(false);
    setSeconds(45);
    setStatus("playing");
  }, [topic]);

  useEffect(() => {
    if (status !== "playing") return;
    const id = window.setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setStatus("lost");
          setStreak(0);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [status, round, topic]);

  const submit = () => {
    if (!item || status !== "playing") return;
    if (guess.trim().toLowerCase() === item.word.toLowerCase()) {
      const gained = showHint ? 5 : Math.max(6, Math.ceil(seconds / 3) + item.word.length);
      setScore((s) => s + gained);
      setStreak((s) => {
        const next = s + 1;
        setBest((b) => Math.max(b, next));
        return next;
      });
      setStatus("won");
    } else {
      setStreak(0);
      setSeconds((s) => Math.max(1, s - 5));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          <span className="mr-2 text-muted-foreground">Mavzu</span>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold">
          <Trophy className="h-4 w-4 text-amber-500" /> {score} ball
        </span>
        <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
          Seriya: <b>{streak}</b> · Rekord: <b>{best}</b>
        </span>
        <span
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${
            seconds <= 10 ? "border-destructive text-destructive" : "border-border"
          }`}
        >
          <Timer className="h-4 w-4" /> {seconds}s
        </span>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Harflarni to'g'ri joylashtiring
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {scrambled.split("").map((letter, i) => (
            <span
              key={`${letter}-${i}`}
              className="grid h-11 w-11 place-items-center rounded-lg border border-primary/30 bg-primary/5 text-lg font-extrabold uppercase text-primary"
            >
              {letter}
            </span>
          ))}
        </div>

        {showHint && item && (
          <p className="mt-4 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
            Ma'no: {item.hint}
          </p>
        )}

        {status === "playing" ? (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <input
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Javobingiz"
              className="min-w-[180px] flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
            />
            <button
              onClick={submit}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              <Check className="h-4 w-4" /> Tekshirish
            </button>
            <button
              onClick={() => setShowHint(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold"
            >
              <Lightbulb className="h-4 w-4 text-amber-500" /> Yordam
            </button>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <p className={`text-sm font-bold ${status === "won" ? "text-emerald-600" : "text-destructive"}`}>
              {status === "won" ? "To'g'ri! " : "Vaqt tugadi. "}
              <span className="font-extrabold uppercase">{item?.word}</span>
            </p>
            <button
              onClick={() => nextRound(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              <RefreshCw className="h-4 w-4" /> Keyingi so'z
            </button>
          </div>
        )}
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <SpellCheck2 className="h-3.5 w-3.5" /> Tez javob bergan sari ball ko'proq. Yordam olsangiz 5
        ball beriladi.
      </p>
    </div>
  );
}
