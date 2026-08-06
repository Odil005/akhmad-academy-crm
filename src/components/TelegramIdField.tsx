import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { saveTelegramId, sendTelegramTest } from "@/lib/telegram-profile.functions";
import { Loader2, Send, Save, BadgeCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Kind = "student" | "profile";

export type TelegramState = {
  chat_id: string | null;
  username: string | null;
  verified_at: string | null;
  last_checked_at: string | null;
  last_error: string | null;
};

/**
 * Reusable Telegram ID editor for a student, teacher or staff profile.
 * `kind = "profile"` covers teachers, admins and directors (public.profiles).
 */
export function TelegramIdField({
  kind,
  subjectId,
  initial,
  title = "Telegram ID",
}: {
  kind: Kind;
  subjectId: string;
  initial?: Partial<TelegramState>;
  title?: string;
}) {
  const save = useServerFn(saveTelegramId);
  const test = useServerFn(sendTelegramTest);

  const [chatId, setChatId] = useState(initial?.chat_id ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [verifiedAt, setVerifiedAt] = useState(initial?.verified_at ?? null);
  const [checkedAt, setCheckedAt] = useState(initial?.last_checked_at ?? null);
  const [lastError, setLastError] = useState(initial?.last_error ?? null);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);

  const onSave = async () => {
    if (chatId && !/^\d{5,20}$/.test(chatId.trim())) {
      toast.error("Telegram ID faqat raqam bo'lishi kerak (@username alohida maydonga)");
      return;
    }
    setBusy("save");
    try {
      const res = await save({ data: { kind, subjectId, chatId: chatId.trim(), username: username.trim() } });
      if (!res.ok) { toast.error(res.error); return; }
      setVerifiedAt(null);
      setLastError(null);
      toast.success("Telegram ID saqlandi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusy(null);
    }
  };

  const onTest = async () => {
    setBusy("test");
    try {
      const res = await test({ data: { kind, subjectId } });
      setCheckedAt(new Date().toISOString());
      if (!res.ok) {
        setVerifiedAt(null);
        setLastError(res.error);
        toast.error(res.error);
        return;
      }
      setVerifiedAt(new Date().toISOString());
      setLastError(null);
      toast.success("Test xabar yuborildi — Tasdiqlangan");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusy(null);
    }
  };

  const status = verifiedAt
    ? { label: "Tasdiqlangan", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600", Icon: BadgeCheck }
    : lastError
      ? { label: "Xabar yuborilmadi", cls: "border-destructive/40 bg-destructive/10 text-destructive", Icon: AlertTriangle }
      : { label: "Tasdiqlanmagan", cls: "border-border bg-muted text-muted-foreground", Icon: AlertTriangle };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold">{title}</h3>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}>
          <status.Icon className="h-3 w-3" /> {status.label}
        </span>
        {checkedAt && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            Oxirgi tekshirish: {new Date(checkedAt).toLocaleString("uz-UZ")}
          </span>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Telegram xabarlari ishlashi uchun avval markazning Telegram botiga <b>/start</b> yuboring.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-sm">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Telegram chat ID</div>
          <input
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            inputMode="numeric"
            placeholder="123456789"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block text-sm">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Username (ixtiyoriy)</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@username"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      {lastError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">{lastError}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onSave}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Saqlash
        </button>
        <button
          onClick={onTest}
          disabled={busy !== null || !chatId}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/50 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-60"
        >
          {busy === "test" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Tekshirish uchun xabar yuborish
        </button>
      </div>
    </div>
  );
}
