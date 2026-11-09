/**
 * 58 mm thermal receipt (Xprinter XP-58 and similar USB printers), "full" layout:
 * logo, center contacts, student/parent/course/teacher, totals, remaining debt,
 * next due date, cashier, signature line and a QR with the receipt summary.
 * Printed through the browser print dialog using the printer's OS driver.
 */
export type Receipt58 = {
  centerName: string;
  centerPhone?: string | null;
  centerSite?: string | null;
  logoUrl?: string | null;
  receiptNo: string;
  date: Date;
  studentName: string;
  parentPhone?: string | null;
  courseName?: string | null;
  teacherName?: string | null;
  periodMonth: string; // YYYY-MM-DD or YYYY-MM
  subtotal: number;
  discount?: number | null;
  method?: string | null;
  debtLeft?: number | null;
  nextDue?: string | null; // YYYY-MM-DD
  cashierName?: string | null;
  qrDataUrl?: string | null;
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

/** Next payment is due on the 10th of the month after the paid period. */
export function receiptNextDue(period: string): string | null {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return null;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-10`;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) =>
  `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const day = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
};

/** Plain-text summary encoded in the QR so the receipt can be checked by scanning. */
export function receiptQrText(r: Receipt58): string {
  return [
    r.centerName,
    `Chek ${r.receiptNo}`,
    stamp(r.date),
    r.studentName,
    receiptPeriod(r.periodMonth),
    `JAMI ${receiptMoney(receiptTotal(r.subtotal, r.discount))}`,
  ].join("\n");
}

export function buildReceipt58Html(r: Receipt58): string {
  const discount = Math.max(0, Number(r.discount) || 0);
  const total = receiptTotal(r.subtotal, discount);
  const row = (k: string, v: string) => `<div class="row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Chek ${esc(r.receiptNo)}</title>
<style>
@page { size: 58mm auto; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { width: 58mm; padding: 3mm 4mm 8mm; font: 11px/1.35 "Courier New", monospace; }
.c { text-align: center; }
.t { font-size: 14px; font-weight: 700; letter-spacing: .5px; }
.s { font-size: 10px; }
.hr { border-top: 1px dashed #000; margin: 5px 0; }
.hr2 { border-top: 2px solid #000; margin: 5px 0; }
.row { display: flex; justify-content: space-between; gap: 4px; }
.row span { flex-shrink: 0; }
.row b { text-align: right; word-break: break-word; }
.total { display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; margin: 3px 0; }
img.logo { width: 22mm; display: block; margin: 0 auto 2px; filter: grayscale(1) contrast(1.4); }
img.qr { width: 24mm; display: block; margin: 6px auto 0; image-rendering: pixelated; }
</style></head><body>
${r.logoUrl ? `<img class="logo" src="${esc(r.logoUrl)}" alt="">` : ""}
<div class="c t">${esc(r.centerName.toUpperCase())}</div>
${r.centerPhone ? `<div class="c s">Tel: ${esc(r.centerPhone)}</div>` : ""}
${r.centerSite ? `<div class="c s">${esc(r.centerSite)}</div>` : ""}
<div class="hr2"></div>
<div class="c" style="font-weight:700">TO'LOV CHEKI</div>
<div class="hr"></div>
${row("Chek №", r.receiptNo)}
${row("Sana", stamp(r.date))}
${row("O'quvchi", r.studentName)}
${r.parentPhone ? row("Ota-ona", r.parentPhone) : ""}
${r.courseName ? row("Kurs", r.courseName) : ""}
${r.teacherName ? row("O'qituvchi", r.teacherName) : ""}
${row("Davr", receiptPeriod(r.periodMonth))}
${row("To'lov turi", METHOD_LABEL[r.method ?? "cash"] ?? "—")}
<div class="hr"></div>
${row("Summa", receiptMoney(r.subtotal))}
${discount > 0 ? row("Chegirma", `-${receiptMoney(discount)}`) : ""}
<div class="total"><span>JAMI</span><span>${esc(receiptMoney(total))}</span></div>
${r.debtLeft != null ? row("Qolgan qarz", receiptMoney(Math.max(0, r.debtLeft))) : ""}
${r.nextDue ? row("Keyingi to'lov", day(r.nextDue)) : ""}
<div class="hr"></div>
${r.cashierName ? row("Kassir", r.cashierName) : ""}
<div class="row" style="margin-top:10px"><span>Imzo:</span><span>______________</span></div>
${r.qrDataUrl ? `<img class="qr" src="${r.qrDataUrl}" alt=""><div class="c s">Chekni tekshirish uchun skanerlang</div>` : ""}
<div class="c s" style="margin-top:6px">Rahmat! Bilim — kelajak kaliti</div>
</body></html>`;
}

/** Opens the print dialog for one receipt using a hidden frame (the CRM page is not printed). */
export async function printReceipt58(input: Receipt58): Promise<void> {
  if (typeof document === "undefined") return;
  let r = input;
  if (!r.qrDataUrl) {
    try {
      const QR = await import("qrcode");
      const qrDataUrl = await QR.toDataURL(receiptQrText(r), { margin: 1, scale: 4, errorCorrectionLevel: "M" });
      r = { ...r, qrDataUrl };
    } catch { /* receipt still prints without QR */ }
  }
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
  // Wait for the logo/QR so the printer does not get a half-rendered receipt.
  await Promise.all(
    Array.from(doc.images).map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((res) => { img.onload = img.onerror = () => res(); setTimeout(res, 3000); }),
    ),
  );
  win.addEventListener("afterprint", () => setTimeout(() => frame.remove(), 1000), { once: true });
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => frame.isConnected && frame.remove(), 60_000);
  }, 100);
}

const AUTO_KEY = "receipt-auto-print";
export const getReceiptAutoPrint = () => {
  try { return localStorage.getItem(AUTO_KEY) !== "0"; } catch { return true; }
};
export const setReceiptAutoPrint = (v: boolean) => {
  try { localStorage.setItem(AUTO_KEY, v ? "1" : "0"); } catch { /* ignore */ }
};
