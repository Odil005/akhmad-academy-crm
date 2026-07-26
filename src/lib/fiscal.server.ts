/**
 * Fiscal provider adapter layer.
 *
 * The CRM NEVER invents a fiscal sign or QR code. Real fiscal data must come
 * from a licensed O'zbekiston online-NKM / virtual cash register provider.
 * Until real credentials are configured the mock provider is used and every
 * receipt is explicitly marked "TEST CHEK — FISKAL EMAS".
 */

export type FiscalItem = {
  name: string;
  qty: number;
  price: number; // per unit, in so'm
  vatPercent?: number;
};

export type CreateReceiptInput = {
  idempotencyKey: string;
  items: FiscalItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: "cash" | "card" | "qr" | "transfer";
  cashierName: string;
  customerName: string;
  period: string;
  courseName: string;
};

export type FiscalReceiptResult = {
  providerName: string;
  providerTransactionId: string;
  receiptNumber: string;
  fiscalSign: string;
  qrData: string;
  receiptUrl: string | null;
  cashboxId: string | null;
  dateTime: string;
  testMode: boolean;
  raw: Record<string, unknown>;
};

export type ShiftStatus = { open: boolean; shiftId?: string | null; openedAt?: string | null; raw?: unknown };

export interface FiscalProvider {
  readonly name: string;
  readonly testMode: boolean;
  createReceipt(input: CreateReceiptInput): Promise<FiscalReceiptResult>;
  getReceiptStatus(providerTransactionId: string): Promise<{ status: string; raw?: unknown }>;
  cancelReceipt(providerTransactionId: string, reason: string): Promise<{ ok: boolean; raw?: unknown }>;
  refundReceipt(providerTransactionId: string, amount: number, reason: string): Promise<{ ok: boolean; raw?: unknown }>;
  getShiftStatus(): Promise<ShiftStatus>;
  openShift(): Promise<ShiftStatus>;
  closeShift(): Promise<ShiftStatus>;
}

export type FiscalConfig = {
  providerName: string;
  cashboxId: string | null;
  companyTin: string | null;
  enabled: boolean;
  testMode: boolean;
};

/* ------------------------------------------------------------------ */
/* Mock provider — TEST ONLY                                           */
/* ------------------------------------------------------------------ */

export const MOCK_NOTICE = "TEST CHEK — FISKAL EMAS";

class MockFiscalProvider implements FiscalProvider {
  readonly name = "mock";
  readonly testMode = true;

  async createReceipt(input: CreateReceiptInput): Promise<FiscalReceiptResult> {
    const now = new Date();
    const num = `T-${now.getTime().toString().slice(-8)}`;
    return {
      providerName: this.name,
      providerTransactionId: `mock_${input.idempotencyKey}`,
      receiptNumber: num,
      fiscalSign: MOCK_NOTICE,
      qrData: "", // never fabricate a QR — real QR only from a licensed provider
      receiptUrl: null,
      cashboxId: null,
      dateTime: now.toISOString(),
      testMode: true,
      raw: { mock: true, notice: MOCK_NOTICE, input },
    };
  }
  async getReceiptStatus() { return { status: "test" }; }
  async cancelReceipt() { return { ok: true, raw: { mock: true } }; }
  async refundReceipt() { return { ok: true, raw: { mock: true } }; }
  async getShiftStatus(): Promise<ShiftStatus> { return { open: true, shiftId: "mock-shift" }; }
  async openShift(): Promise<ShiftStatus> { return { open: true, shiftId: "mock-shift" }; }
  async closeShift(): Promise<ShiftStatus> { return { open: false, shiftId: null }; }
}

/* ------------------------------------------------------------------ */
/* Real provider — generic REST adapter for a virtual cash register    */
/* ------------------------------------------------------------------ */

class HttpFiscalProvider implements FiscalProvider {
  readonly name: string;
  readonly testMode: boolean;
  private base: string;
  private token: string;
  private cashboxId: string;
  private tin: string;

  constructor(cfg: { name: string; base: string; token: string; cashboxId: string; tin: string; testMode: boolean }) {
    this.name = cfg.name;
    this.base = cfg.base.replace(/\/+$/, "");
    this.token = cfg.token;
    this.cashboxId = cfg.cashboxId;
    this.tin = cfg.tin;
    this.testMode = cfg.testMode;
  }

  private async call(path: string, method: string, body?: unknown) {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try { json = text ? (JSON.parse(text) as Record<string, unknown>) : {}; } catch { json = { raw: text }; }
    if (!res.ok) {
      throw new Error(`Fiskal provayder xatosi [${res.status}]: ${text.slice(0, 400)}`);
    }
    return json;
  }

  async createReceipt(input: CreateReceiptInput): Promise<FiscalReceiptResult> {
    const payload = {
      cashbox_id: this.cashboxId,
      tin: this.tin,
      idempotency_key: input.idempotencyKey,
      received_cash: input.paymentMethod === "cash" ? input.total : 0,
      received_card: input.paymentMethod === "cash" ? 0 : input.total,
      payment_method: input.paymentMethod,
      customer_name: input.customerName,
      items: input.items.map((i) => ({
        name: i.name,
        qty: i.qty,
        price: Math.round(i.price * 100),
        vat_percent: i.vatPercent ?? 0,
      })),
      discount: Math.round(input.discount * 100),
      total: Math.round(input.total * 100),
    };
    const r = await this.call("/receipts", "POST", payload);
    const d = ((r.data as Record<string, unknown>) ?? r) as Record<string, unknown>;
    const str = (k: string) => (d[k] == null ? null : String(d[k]));
    const receiptNumber = str("receipt_number") ?? str("receiptId") ?? str("id") ?? "";
    const fiscalSign = str("fiscal_sign") ?? str("fiscalSign") ?? "";
    const qrData = str("qr_data") ?? str("qrCodeURL") ?? str("qr") ?? "";
    if (!fiscalSign || !qrData) {
      throw new Error("Provayder fiskal belgi yoki QR ma'lumotini qaytarmadi");
    }
    return {
      providerName: this.name,
      providerTransactionId: str("transaction_id") ?? str("terminalId") ?? receiptNumber,
      receiptNumber,
      fiscalSign,
      qrData,
      receiptUrl: str("receipt_url"),
      cashboxId: this.cashboxId,
      dateTime: str("date_time") ?? new Date().toISOString(),
      testMode: this.testMode,
      raw: r,
    };
  }

  async getReceiptStatus(id: string) {
    const r = await this.call(`/receipts/${encodeURIComponent(id)}`, "GET");
    return { status: String((r as Record<string, unknown>).status ?? "unknown"), raw: r };
  }
  async cancelReceipt(id: string, reason: string) {
    const r = await this.call(`/receipts/${encodeURIComponent(id)}/cancel`, "POST", { reason });
    return { ok: true, raw: r };
  }
  async refundReceipt(id: string, amount: number, reason: string) {
    const r = await this.call(`/receipts/${encodeURIComponent(id)}/refund`, "POST", { amount: Math.round(amount * 100), reason });
    return { ok: true, raw: r };
  }
  async getShiftStatus(): Promise<ShiftStatus> {
    const r = await this.call(`/shifts/current?cashbox_id=${encodeURIComponent(this.cashboxId)}`, "GET");
    const d = r as Record<string, unknown>;
    return { open: Boolean(d.open ?? d.is_open), shiftId: d.id ? String(d.id) : null, openedAt: d.opened_at ? String(d.opened_at) : null, raw: r };
  }
  async openShift(): Promise<ShiftStatus> {
    const r = await this.call(`/shifts/open`, "POST", { cashbox_id: this.cashboxId });
    return { open: true, shiftId: (r as Record<string, unknown>).id ? String((r as Record<string, unknown>).id) : null, raw: r };
  }
  async closeShift(): Promise<ShiftStatus> {
    const r = await this.call(`/shifts/close`, "POST", { cashbox_id: this.cashboxId });
    return { open: false, shiftId: null, raw: r };
  }
}

/**
 * Resolve the provider for the current configuration.
 * Real mode requires: settings.enabled && !settings.test_mode && all env secrets.
 */
export function resolveFiscalProvider(cfg: FiscalConfig): { provider: FiscalProvider; real: boolean; reason?: string } {
  const url = process.env.FISCAL_API_URL ?? "";
  const token = process.env.FISCAL_API_TOKEN ?? "";
  const cashbox = cfg.cashboxId || process.env.FISCAL_CASHBOX_ID || "";
  const tin = cfg.companyTin || process.env.FISCAL_COMPANY_TIN || "";

  if (!cfg.enabled) return { provider: new MockFiscalProvider(), real: false, reason: "Virtual kassa sozlamalarda yoqilmagan" };
  if (cfg.testMode) return { provider: new MockFiscalProvider(), real: false, reason: "Test rejimi yoqilgan" };
  if (!url || !token || !cashbox || !tin) {
    return { provider: new MockFiscalProvider(), real: false, reason: "Fiskal API manzili, tokeni yoki kassa ma'lumotlari kiritilmagan" };
  }
  return {
    provider: new HttpFiscalProvider({ name: cfg.providerName || "virtual_kassa", base: url, token, cashboxId: cashbox, tin, testMode: false }),
    real: true,
  };
}
