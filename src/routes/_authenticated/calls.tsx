import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Plus, X, Play } from "lucide-react";
import { toast } from "sonner";

type Call = {
  id: string;
  direction: "inbound" | "outbound";
  phone: string;
  duration_sec: number;
  status: string;
  recording_url: string | null;
  called_at: string;
  notes: string | null;
};

export const Route = createFileRoute("/_authenticated/calls")({
  component: CallsPage,
});

function CallsPage() {
  const { roles, user } = Route.useRouteContext();
  const isStaff = roles.includes("director") || roles.includes("admin");
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("calls")
      .select("id, direction, phone, duration_sec, status, recording_url, called_at, notes")
      .order("called_at", { ascending: false })
      .limit(200);
    setCalls((data as Call[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (isStaff) load(); }, [isStaff]);

  if (!isStaff) {
    return <p className="text-sm text-muted-foreground">Sizga bu bo'lim uchun ruxsat yo'q.</p>;
  }

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const fmtDate = (s: string) => new Date(s).toLocaleString("uz-UZ");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Qo'ng'iroqlar</h1>
          <p className="text-sm text-muted-foreground">IP-telefoniya jurnali</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Qo'shish
        </button>
      </div>

      <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">GSM modem (SIM karta) integratsiyasi</p>
        <p><strong className="text-foreground">Webhook (modem → server):</strong> <code className="rounded bg-background px-1.5 py-0.5">POST /api/public/telephony/webhook?secret=YOUR_SECRET</code></p>
        <p><strong className="text-foreground">Outbox (modem ↔ server):</strong> <code className="rounded bg-background px-1.5 py-0.5">GET /api/public/telephony/outbox?secret=YOUR_SECRET</code> — modem har 5-10 sekundda so'raydi va <em>queued</em> chiquvchi qo'ng'iroq/SMSlarni oladi.</p>
        <p className="mt-2 font-semibold text-foreground">Modem tomonida sozlash:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li><strong>GoIP / DBL / Portech:</strong> HTTP CDR / Push URL bo'limiga webhook URL ni kiriting.</li>
          <li><strong>SIM800/900 (Arduino/ESP32):</strong> RING/CLIP eventida <code>HTTP POST</code> JSON <code>{`{"event":"ring","caller":"+998..."}`}</code> yuboring.</li>
          <li><strong>Raspberry Pi + gammu-smsd:</strong> <code>RunOnReceive</code> skripti orqali <code>curl</code> yuboring.</li>
          <li><strong>Asterisk chan_dongle:</strong> dialplan <code>System(curl ...)</code> ishlatib CDR uzating.</li>
        </ul>
        <p className="mt-2">Secret ni sozlash uchun <code>TELEPHONY_WEBHOOK_SECRET</code> serverga qo'shing.</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
      ) : calls.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Hali qo'ng'iroqlar yo'q
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {calls.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${dirBg(c.direction, c.status)}`}>
                  {dirIcon(c.direction, c.status)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold">{c.phone}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">{c.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{fmtDate(c.called_at)} · {fmtDur(c.duration_sec)}</div>
                  {c.notes && <div className="mt-1 text-xs">{c.notes}</div>}
                </div>
                {c.recording_url && (
                  <a href={c.recording_url} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg border border-border p-2 hover:border-primary">
                    <Play className="h-4 w-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && <NewCallModal userId={user.id} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); toast.success("Qo'shildi"); }} />}
    </div>
  );
}

function dirIcon(d: string, s: string) {
  if (s === "missed" || s === "no_answer") return <PhoneMissed className="h-4 w-4 text-destructive" />;
  if (d === "inbound") return <PhoneIncoming className="h-4 w-4 text-emerald-500" />;
  return <PhoneOutgoing className="h-4 w-4 text-sky-500" />;
}
function dirBg(d: string, s: string) {
  if (s === "missed" || s === "no_answer") return "bg-destructive/10";
  if (d === "inbound") return "bg-emerald-500/10";
  return "bg-sky-500/10";
}

function NewCallModal({ userId, onClose, onDone }: { userId: string; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    direction: "outbound" as "inbound" | "outbound",
    phone: "",
    duration_sec: 0,
    status: "completed",
    notes: "",
  });
  const [queueForModem, setQueueForModem] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const payload = queueForModem
      ? { ...form, status: "queued", direction: "outbound" as const, duration_sec: 0, created_by: userId }
      : { ...form, created_by: userId };
    const { error } = await supabase.from("calls").insert(payload);
    if (error) { setError(error.message); setLoading(false); return; }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Qo'ng'iroq qo'shish</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as "inbound" | "outbound" })} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
              <option value="outbound">Chiquvchi</option>
              <option value="inbound">Kiruvchi</option>
            </select>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
              <option value="completed">Bajarilgan</option>
              <option value="missed">O'tkazib yuborilgan</option>
              <option value="no_answer">Javob yo'q</option>
              <option value="busy">Band</option>
              <option value="failed">Xatolik</option>
            </select>
          </div>
          <input required placeholder="+998..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <input type="number" min={0} placeholder="Davomiyligi (sek)" value={form.duration_sec} onChange={(e) => setForm({ ...form, duration_sec: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <textarea placeholder={queueForModem ? "SMS matni yoki izoh (modem yuboradi)" : "Izoh"} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" rows={2} />
          <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs">
            <input type="checkbox" checked={queueForModem} onChange={(e) => setQueueForModem(e.target.checked)} />
            <span>Modem orqali yuborish (queued) — SIM karta orqali chiquvchi qo'ng'iroq / SMS</span>
          </label>
          {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {loading ? "..." : queueForModem ? "Modemga yuborish" : "Saqlash"}
          </button>
        </form>
      </div>
    </div>
  );
}
