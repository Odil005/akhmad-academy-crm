import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  MessageSquare,
  Send,
  Copy,
  Link as LinkIcon,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { sendParentTelegram } from "@/lib/notifications.functions";
import { setTelegramWebhook, getTelegramBotInfo } from "@/lib/telegram-admin.functions";

export const Route = createFileRoute("/_authenticated/settings/integrations")({
  component: IntegrationsSettings,
});

const KEYS = [
  {
    key: "sms_provider",
    label: "SMS provayder API kaliti",
    scope: "director",
    field: "api_key",
    placeholder: "eskiz-api-key",
  },
  {
    key: "sms_templates",
    label: "SMS shablon (to'lov eslatmasi)",
    scope: "admin",
    field: "payment_reminder",
    placeholder: "Hurmatli [ParentName], farzandingiz uchun [Amount] so'm to'lov kutilmoqda.",
  },
];

function IntegrationsSettings() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in(
        "key",
        KEYS.map((k) => k.key),
      )
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((r) => {
          const cfg = KEYS.find((k) => k.key === r.key);
          const value = r.value as Record<string, unknown> | null;
          if (cfg) {
            const fieldValue = value?.[cfg.field];
            map[r.key] = typeof fieldValue === "string" ? fieldValue : "";
          }
        });
        setValues(map);
      });
  }, []);

  const save = async (cfg: (typeof KEYS)[number]) => {
    setSaving(cfg.key);
    const { error } = await supabase.from("settings").upsert({
      key: cfg.key,
      scope: cfg.scope,
      value: { [cfg.field]: values[cfg.key] ?? "" },
    });
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success("Saqlandi");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Integratsiyalar</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {KEYS.map((cfg) => (
            <div key={cfg.key} className="space-y-2">
              <label className="block text-sm">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {cfg.label}{" "}
                  <span className="ml-1 rounded bg-secondary px-1.5 text-[9px]">{cfg.scope}</span>
                </div>
                <textarea
                  value={values[cfg.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [cfg.key]: e.target.value })}
                  placeholder={cfg.placeholder}
                  className="min-h-[64px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <button
                disabled={saving === cfg.key}
                onClick={() => save(cfg)}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
              >
                {saving === cfg.key ? "..." : "Saqlash"}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
          <div className="mb-1 flex items-center gap-1.5 font-bold text-emerald-700">
            <ShieldCheck className="h-4 w-4" /> Telegram tokeni himoyalangan
          </div>
          Bot tokeni CRM oynasiga kiritilmaydi va bazaga yozilmaydi. Uni faqat Vercel Environment
          Variables bo'limidagi <code>TELEGRAM_BOT_TOKEN</code> maydoniga kiriting.
        </div>
      </div>

      <TelegramWebhookCard />
      <CronReminderCard />
      <TelegramTestCard />
    </div>
  );
}

function CronReminderCard() {
  const [origin, setOrigin] = useState<string>("");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);
  const url = origin ? `${origin}/api/public/cron/reminders` : "";
  const copy = () => {
    navigator.clipboard.writeText(url);
    toast.success("Nusxalandi");
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-3 flex items-center gap-2">
        <Send className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">Avtomatik eslatmalar (cron)</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Kuniga bir marta chaqiring — tizim qarzdor ota-onalarga to'lov eslatmasini va bugungi darsi
        bor o'quvchilar oilasiga dars eslatmasini Telegram orqali yuboradi. Chaqirishda{" "}
        <code className="rounded bg-secondary px-1 py-0.5">x-cron-secret</code> sarlavhasi{" "}
        <code className="rounded bg-secondary px-1 py-0.5">CRON_SECRET</code> maxfiy kaliti bilan
        mos bo'lishi shart.
      </p>
      <div className="rounded-lg border border-border bg-background p-3 text-xs">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Endpoint
        </div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate font-mono">POST {url || "..."}</code>
          <button
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground"
          >
            <Copy className="h-3 w-3" /> Nusxa
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Namuna:{" "}
        <code className="rounded bg-secondary px-1 py-0.5">
          curl -X POST -H "x-cron-secret: &lt;SECRET&gt;" {url || "..."}
        </code>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Har bir yuborish{" "}
        <code className="rounded bg-secondary px-1 py-0.5">parent_notifications</code> jurnaliga
        yoziladi va kunlik takroriy yuborishning oldini oladi.
      </p>
    </div>
  );
}

function TelegramWebhookCard() {
  type BotInfo = {
    configured: boolean;
    healthy?: boolean;
    username?: string | null;
    name?: string | null;
    error?: string;
    webhook?: {
      url: string | null;
      expectedUrl: string | null;
      pending: number;
      lastError: string | null;
      lastErrorAt: string | null;
    };
  };
  const [info, setInfo] = useState<BotInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const registerWebhook = useServerFn(setTelegramWebhook);
  const fetchInfo = useServerFn(getTelegramBotInfo);

  useEffect(() => {
    fetchInfo()
      .then((result) => setInfo(result))
      .catch((error: Error) => setInfo({ configured: true, healthy: false, error: error.message }));
  }, [fetchInfo]);

  const url = info?.webhook?.expectedUrl ?? info?.webhook?.url ?? "";
  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success("Nusxalandi");
  };

  const register = async () => {
    if (!url) return;
    setBusy(true);
    try {
      const r = await registerWebhook();
      const refreshed = await fetchInfo();
      setInfo(refreshed);
      toast.success(`Webhook o'rnatildi${r.username ? ` (@${r.username})` : ""}`);
    } catch (e) {
      toast.error(e instanceof Response ? await e.text() : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-3 flex items-center gap-2">
        <LinkIcon className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">Telegram bot ulash</h3>
      </div>
      <div className="mb-3 rounded-lg border border-border bg-background p-3 text-xs">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Bot holati
        </div>
        {info === null ? (
          <div className="text-muted-foreground">Tekshirilmoqda...</div>
        ) : info.configured && info.healthy ? (
          <div className="flex items-center gap-1.5 text-emerald-600">
            <ShieldCheck className="h-4 w-4" /> Bot va webhook ishlayapti
            {info.username ? ` — @${info.username}` : ""}
          </div>
        ) : info.configured ? (
          <div className="flex items-center gap-1.5 text-amber-600">
            <TriangleAlert className="h-4 w-4" /> Token bor, webhookni tekshiring
            {info.username ? ` — @${info.username}` : ""}
          </div>
        ) : (
          <div className="text-destructive">TELEGRAM_BOT_TOKEN sozlanmagan</div>
        )}
        {info?.error && <div className="mt-1 text-destructive">{info.error}</div>}
        {info?.webhook?.pending ? (
          <div className="mt-1 text-amber-600">
            Navbatdagi Telegram yangilanishlari: {info.webhook.pending}
          </div>
        ) : null}
        {info?.webhook?.lastError && (
          <div className="mt-1 text-destructive">Telegram xatosi: {info.webhook.lastError}</div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-background p-3 text-xs">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Webhook URL
        </div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate font-mono">{url || "..."}</code>
          <button
            disabled={!url}
            onClick={() => copy(url)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
          >
            <Copy className="h-3 w-3" /> Nusxa
          </button>
          <button
            onClick={register}
            disabled={busy || !info?.configured}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "..." : "Webhook o'rnatish"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Ulanish havolalari CRMdagi <b>Tezkor Telegram ID yaratish</b> bo'limida bir martalik va
        muddati cheklangan tarzda yaratiladi. O'quvchi ID sini qo'lda URLga yozish xavfsizlik
        sababli o'chirilgan.
      </p>
    </div>
  );
}

type Student = {
  id: string;
  first_name: string;
  last_name: string | null;
  parent_notifications_enabled: boolean;
  parent_telegram_chat_id: string | null;
};

function TelegramTestCard() {
  const send = useServerFn(sendParentTelegram);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<string>("");
  const [text, setText] = useState<string>("Assalomu alaykum. Bu Akhmad Academy test xabari.");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase
      .from("students")
      .select("id, first_name, last_name, parent_notifications_enabled, parent_telegram_chat_id")
      .not("parent_telegram_chat_id", "is", null)
      .order("first_name")
      .then(({ data }) => {
        const list = (data as Student[] | null) ?? [];
        setStudents(list);
        if (list[0]) setStudentId(list[0].id);
      });
  }, []);

  const submit = async () => {
    if (!studentId) return;
    setSending(true);
    try {
      const r = await send({ data: { student_id: studentId, text, kind: "manual" } });
      if (r.ok) toast.success("Xabar yuborildi");
      else toast.warning("Ota-ona chat_id yo'q — o'tkazib yuborildi");
    } catch (e) {
      toast.error(e instanceof Response ? await e.text() : (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-3 flex items-center gap-2">
        <Send className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">Test xabari</h3>
      </div>
      {students.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Hozircha bog'langan ota-ona yo'q. CRMdan bir martalik Telegram havolasi yarating yoki
          ota-ona botda o'z telefon raqamini yuborsin.
        </p>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              O'quvchi
            </div>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name ?? ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Matn
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <button
            onClick={submit}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Send className="h-4 w-4" /> {sending ? "Yuborilmoqda..." : "Yuborish"}
          </button>
        </div>
      )}
    </div>
  );
}
