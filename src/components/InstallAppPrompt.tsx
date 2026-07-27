import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "aa-install-dismissed";

export function InstallAppPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|Android/.test(ua);
    if (isIos && isSafari) {
      setIosHint(true);
      setVisible(true);
    }

    const onInstalled = () => setVisible(false);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-xl md:left-auto md:right-4 md:mx-0">
      <button
        onClick={dismiss}
        aria-label="Yopish"
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <img src="/icon-192.png" alt="Akhmad Academy ilovasi" className="h-11 w-11 rounded-xl" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Akhmad Academy ilovasi</p>
          {iosHint && !deferred ? (
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              Safari’da <Share className="inline h-3.5 w-3.5" /> «Ulashish» →
              <Plus className="inline h-3.5 w-3.5" /> «Bosh ekranga qo‘shish» ni bosing.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Telefon yoki Windows’ga ilova sifatida o‘rnating — tezroq va qulayroq.
            </p>
          )}
          {deferred && (
            <button
              onClick={install}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              Ilovani o‘rnatish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
