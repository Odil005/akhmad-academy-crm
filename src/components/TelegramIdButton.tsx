import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createTelegramLink } from "@/lib/telegram-admin.functions";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Kind = "student" | "teacher" | "admin" | "director";

/**
 * One-click Telegram ID link generator for a single person.
 * Used on student / teacher profiles so an administrator can create the
 * Telegram connection link right where the profile is open.
 */
export function TelegramIdButton({
  kind,
  id,
  name,
  compact,
}: {
  kind: Kind;
  id: string;
  name: string;
  compact?: boolean;
}) {
  const makeLink = useServerFn(createTelegramLink);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await makeLink({
        data: {
          kind,
          studentId: kind === "student" ? id : null,
          targetUserId: kind === "student" ? null : id,
          label: name,
          ttlMinutes: 60 * 24 * 7,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const url = res.link ?? res.token;
      setLink(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Telegram havolasi yaratildi va nusxalandi");
    } catch (e: any) {
      toast.error(e?.message ?? "Xatolik");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? "inline-flex flex-col items-start gap-1" : "space-y-2"}>
      <button
        onClick={generate}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/50 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        Telegram ID
      </button>
      {link && (
        <span className="block max-w-[240px] break-all font-mono text-[11px] text-muted-foreground">{link}</span>
      )}
    </div>
  );
}
