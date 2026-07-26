import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCashierContext, saveCashRegisterSettings } from "@/lib/payments.functions";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/cash-register")({
  component: CashRegisterSettings,
});

type Form = {
  provider_name: string;
  cashbox_id: string;
  company_tin: string;
  company_name: string;
  branch_address: string;
  vat_enabled: boolean;
  vat_percent: number;
  enabled: boolean;
  test_mode: boolean;
  printer_type: string;
};

const EMPTY: Form = {
  provider_name: "mock", cashbox_id: "", company_tin: "", company_name: "AKHMAD ACADEMY",
  branch_address: "", vat_enabled: false, vat_percent: 12, enabled: false, test_mode: true,
  printer_type: "browser_80mm",
};

function CashRegisterSettings() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof getCashierContext>> | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const c = await getCashierContext().catch(() => null);
    setCtx(c);
    const s = c?.settings;
    if (s) {
      setForm({
        provider_name: s.provider_name ?? "mock",
        cashbox_id: s.cashbox_id ?? "",
        company_tin: s.company_tin ?? "",
        company_name: s.company_name ?? "AKHMAD ACADEMY",
        branch_address: s.branch_address ?? "",
        vat_enabled: !!s.vat_enabled,
        vat_percent: Number(s.vat_percent ?? 12),
        enabled: !!s.enabled,
        test_mode: s.test_mode ?? true,
        printer_type: s.printer_type ?? "browser_80mm",
      });
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      await saveCashRegisterSettings({ data: { ...form, cashbox_id: form.cashbox_id || null, company_tin: form.company_tin || null, branch_address: form.branch_address || null } });
      setMsg("Saqlandi");
      await load();
    } catch (e) {
      setMsg((e as Error)?.message || "Saqlanmadi — faqat direktor sozlay oladi");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Virtual kassa va fiskal chek</h1>
        <p className="text-sm text-muted-foreground">Onlayn-NKM provayderi, kassa ma'lumotlari va printer sozlamalari</p>
      </div>

      {ctx && (
        <div className="grid gap-2 sm:grid-cols-3">
          <Health ok={ctx.fiscal.real} label={ctx.fiscal.real ? "Real fiskal rejim" : `Test rejim — ${ctx.fiscal.reason ?? ""}`} />
          <Health ok={ctx.fiscal.shiftOpen} label={ctx.fiscal.shiftOpen ? "Kassa smenasi ochiq" : "Kassa smenasi yopiq"} />
          <Health ok={ctx.telegram.configured} label={ctx.telegram.configured ? "Telegram bot faol" : "Telegram bot sozlanmagan"} />
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Provayder nomi"><input value={form.provider_name} onChange={(e) => setForm({ ...form, provider_name: e.target.value })} className={inp} /></F>
          <F label="Kassa ID (cashbox)"><input value={form.cashbox_id} onChange={(e) => setForm({ ...form, cashbox_id: e.target.value })} className={inp} /></F>
          <F label="Tashkilot nomi"><input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className={inp} /></F>
          <F label="STIR"><input value={form.company_tin} onChange={(e) => setForm({ ...form, company_tin: e.target.value })} className={inp} /></F>
          <F label="Filial manzili"><input value={form.branch_address} onChange={(e) => setForm({ ...form, branch_address: e.target.value })} className={inp} /></F>
          <F label="Printer turi">
            <select value={form.printer_type} onChange={(e) => setForm({ ...form, printer_type: e.target.value })} className={inp}>
              <option value="browser_80mm">Brauzer orqali 80 mm</option>
              <option value="usb_80mm">USB termoprinter 80 mm</option>
              <option value="lan_80mm">LAN termoprinter 80 mm</option>
              <option value="none">Printer yo'q</option>
            </select>
          </F>
          <F label="QQS foizi"><input type="number" value={form.vat_percent} onChange={(e) => setForm({ ...form, vat_percent: Number(e.target.value) })} className={inp} /></F>
        </div>

        <div className="space-y-2">
          <Chk v={form.enabled} on={(v) => setForm({ ...form, enabled: v })} label="Virtual kassani yoqish" />
          <Chk v={form.test_mode} on={(v) => setForm({ ...form, test_mode: v })} label="Test rejim (cheklar fiskal emas)" />
          <Chk v={form.vat_enabled} on={(v) => setForm({ ...form, vat_enabled: v })} label="Tashkilot QQS to'lovchisi" />
        </div>

        <p className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
          Real fiskal rejim uchun maxfiy kalitlar server tomonda saqlanadi:
          <b> FISCAL_API_URL</b>, <b>FISCAL_API_TOKEN</b>, <b>FISCAL_CASHBOX_ID</b>, <b>FISCAL_COMPANY_TIN</b>, <b>APP_BASE_URL</b>.
          Ular kiritilgach «Test rejim»ni o'chiring.
        </p>

        {msg && <p className="text-xs font-semibold text-muted-foreground">{msg}</p>}

        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Saqlash
        </button>
      </div>
    </div>
  );
}

const inp = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>{children}</label>;
}
function Chk({ v, on, label }: { v: boolean; on: (b: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5">
      <input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} className="h-4 w-4" />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}
function Health({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
      <span className="truncate">{label}</span>
    </div>
  );
}
