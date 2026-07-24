import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Save, Wifi, WifiOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/telephony")({
  component: TelephonySettings,
});

type SipConfig = {
  id?: string;
  provider: string;
  sip_uri: string | null;
  username: string | null;
  auth_id: string | null;
  caller_id: string | null;
  webhook_secret: string | null;
  api_base_url: string | null;
  is_active: boolean;
  notes: string | null;
};

const empty: SipConfig = {
  provider: "custom",
  sip_uri: "",
  username: "",
  auth_id: "",
  caller_id: "",
  webhook_secret: "",
  api_base_url: "",
  is_active: false,
  notes: "",
};

function TelephonySettings() {
  const [cfg, setCfg] = useState<SipConfig>(empty);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("sip_config").select("*").maybeSingle().then(({ data }) => {
      if (data) setCfg({ ...empty, ...data });
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const payload = { ...cfg, singleton: true };
    const { error } = cfg.id
      ? await supabase.from("sip_config").update(payload).eq("id", cfg.id)
      : await supabase.from("sip_config").insert(payload);
    setSaving(false);
    setMsg(error ? `Xato: ${error.message}` : "✅ Saqlandi");
  };

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/public/telephony/sip-webhook`
    : "/api/public/telephony/sip-webhook";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center gap-3">
        <div className={`rounded-2xl p-3 ${cfg.is_active ? "bg-green-500/15 text-green-500" : "bg-muted text-muted-foreground"}`}>
          {cfg.is_active ? <Wifi className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">IP Telefoniya — SIP Trunk</h1>
          <p className="text-sm text-muted-foreground">
            SIP provayder ma'lumotlarini kiriting. CRM ichidan qo'ng'iroq va webhook orqali qo'ng'iroq tarixi.
          </p>
        </div>
      </header>

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-6">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={cfg.is_active}
            onChange={(e) => setCfg({ ...cfg, is_active: e.target.checked })}
            className="h-4 w-4"
          />
          <span className="text-sm font-semibold">SIP trunkni yoqish</span>
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Provider" value={cfg.provider} onChange={(v) => setCfg({ ...cfg, provider: v })}>
            <select
              value={cfg.provider}
              onChange={(e) => setCfg({ ...cfg, provider: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="custom">Custom / Boshqa</option>
              <option value="uztelecom">UzTelecom</option>
              <option value="beeline">Beeline UZ</option>
              <option value="ucell">Ucell</option>
              <option value="mango">Mango Office</option>
              <option value="voximplant">Voximplant</option>
              <option value="twilio">Twilio</option>
            </select>
          </Field>

          <Text label="Caller ID (chiquvchi raqam)" value={cfg.caller_id ?? ""} onChange={(v) => setCfg({ ...cfg, caller_id: v })} placeholder="+998 XX XXX XX XX" />
          <Text label="SIP URI" value={cfg.sip_uri ?? ""} onChange={(v) => setCfg({ ...cfg, sip_uri: v })} placeholder="sip:trunk@provider.com" />
          <Text label="Login (username)" value={cfg.username ?? ""} onChange={(v) => setCfg({ ...cfg, username: v })} />
          <Text label="Auth ID" value={cfg.auth_id ?? ""} onChange={(v) => setCfg({ ...cfg, auth_id: v })} />
          <Text label="API Base URL" value={cfg.api_base_url ?? ""} onChange={(v) => setCfg({ ...cfg, api_base_url: v })} placeholder="https://api.provider.com/v1" />
          <Text label="Webhook Secret (HMAC)" value={cfg.webhook_secret ?? ""} onChange={(v) => setCfg({ ...cfg, webhook_secret: v })} />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Izohlar</label>
          <textarea
            value={cfg.notes ?? ""}
            onChange={(e) => setCfg({ ...cfg, notes: e.target.value })}
            className="mt-1 min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-primary">Webhook URL</div>
          <code className="mt-1 block break-all text-xs">{webhookUrl}</code>
          <p className="mt-2 text-xs text-muted-foreground">
            Provayder panelida qo'ng'iroq eventlarini shu URL'ga yuboradigan qilib sozlang. HMAC-SHA256 imzo <code>x-sip-signature</code> header'ida (secret yuqorida).
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm">{msg}</div>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <Phone className="h-5 w-5 text-primary" /> Click-to-Call
        </h2>
        <p className="text-sm text-muted-foreground">
          Xodimlar lidlar va o'quvchilar sahifasidan qo'ng'iroq tugmasini bosib qo'ng'iroq qila oladi. Qo'ng'iroq tarixi va yozuvlari avtomatik saqlanadi.
        </p>
      </div>
    </div>
  );
}

function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

function Field({ label, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
