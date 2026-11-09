/**
 * 58 mm thermal receipt (Xprinter XP-58 and similar USB printers).
 * Printed through the browser print dialog using the printer's Windows driver,
 * so no extra program is needed. Printable width on 58 mm paper is ~48 mm.
 */
export type Receipt58 = {
  centerName: string;
  centerPhone?: string | null;
  centerAddress?: string | null;
  receiptNo: string;
  date: Date;
  studentName: string;
  courseName?: string | null;
  periodMonth: string; // YYYY-MM-DD or YYYY-MM
  subtotal: number;
  discount?: number | null;
  method?: string | null;
  cashierName?: string | null;
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Naqd",
  card: "Bank kartasi",
  qr: "QR to'lov",
  transfer: "Bank o'tkazmasi",
};

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];

export const receiptMoney = (n: number) =>
  `${Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;

export function receiptTotal(subtotal: number, discount?: number | null): number {
  return Math.max(0, Math.round((Number(subtotal) || 0) - Math.max(0, Number(discount) || 0)));
}

export function receiptPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return period;
  return `${MONTHS[m - 1]} ${y}`;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) =>
  `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function buildReceipt58Html(r: Receipt58): string {
  const discount = Math.max(0, Number(r.discount) || 0);
  const total = receiptTotal(r.subtotal, discount);
  const row = (k: string, v: string) => `<div class="row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Chek ${esc(r.receiptNo)}</title>
<style>
@page { size: 58mm auto; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { width: 58mm; padding: 2mm 4mm 6mm; font: 11px/1.3 "Courier New", monospace; }
.c { text-align: center; }
.t { font-size: 14px; font-weight: 700; letter-spacing: .5px; }
.s { font-size: 10px; }
.hr { border-top: 1px dashed #000; margin: 5px 0; }
.row { display: flex; justify-content: space-between; gap: 4px; }
.row span { flex-shrink: 0; }
.row b { text-align: right; word-break: break-word; }
.total { display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-top: 3px; }
</style></head><body>
<div class="c t">${esc(r.centerName.toUpperCase())}</div>
${r.centerAddress ? `<div class="c s">${esc(r.centerAddress)}</div>` : ""}
${r.centerPhone ? `<div class="c s">Tel: ${esc(r.centerPhone)}</div>` : ""}
<div class="hr"></div>
${row("Chek №", r.receiptNo)}
${row("Sana", stamp(r.date))}
${row("O'quvchi", r.studentName)}
${r.courseName ? row("Kurs", r.courseName) : ""}
${row("Davr", receiptPeriod(r.periodMonth))}
${row("To'lov turi", METHOD_LABEL[r.method ?? "cash"] ?? "—")}
<div class="hr"></div>
${row("Summa", receiptMoney(r.subtotal))}
${discount > 0 ? row("Chegirma", `-${receiptMoney(discount)}`) : ""}
<div class="total"><span>JAMI</span><span>${esc(receiptMoney(total))}</span></div>
<div class="hr"></div>
${r.cashierName ? row("Kassir", r.cashierName) : ""}
<div class="c s" style="margin-top:6px">To'lov qabul qilindi. Rahmat!</div>
</body></html>`;
}

/** Opens the print dialog for one receipt using a hidden frame (the CRM page is not printed). */
export function printReceipt58(r: Receipt58): void {
  if (typeof document === "undefined") return;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); return; }
  doc.open();
  doc.write(buildReceipt58Html(r));
  doc.close();
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener("afterprint", cleanup, { once: true });
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => frame.isConnected && frame.remove(), 60_000);
  }, 150);
}

const AUTO_KEY = "receipt-auto-print";
export const getReceiptAutoPrint = () => {
  try { return localStorage.getItem(AUTO_KEY) !== "0"; } catch { return true; }
};
export const setReceiptAutoPrint = (v: boolean) => {
  try { localStorage.setItem(AUTO_KEY, v ? "1" : "0"); } catch { /* ignore */ }
};
