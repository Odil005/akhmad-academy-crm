export type ContractData = {
  centerName: string;
  centerPhone: string | null;
  centerAddress: string | null;
  studentName: string;
  studentPhone: string | null;
  parentName: string | null;
  parentPhone: string | null;
  groups: { name: string; fee: number }[];
  date: Date;
  number: string;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const money = (n: number) => `${Math.round(n).toLocaleString("uz-UZ").replace(/,/g, " ")} so'm`;

export function contractTotal(groups: { fee: number }[]): number {
  return groups.reduce((s, g) => s + (Number(g.fee) || 0), 0);
}

export function buildContractHtml(d: ContractData): string {
  const date = d.date.toLocaleDateString("uz-UZ");
  const rows = d.groups.length
    ? d.groups.map((g, i) => `<tr><td>${i + 1}</td><td>${esc(g.name)}</td><td style="text-align:right">${money(g.fee)}</td></tr>`).join("")
    : `<tr><td colspan="3">Guruh biriktirilmagan</td></tr>`;
  const copy = (label: string) => `
  <section class="page">
    <div class="copy">${label}</div>
    <h1>O'QUV XIZMATLARI KO'RSATISH SHARTNOMASI № ${esc(d.number)}</h1>
    <p class="meta">Sana: ${date}</p>
    <p><b>${esc(d.centerName)}</b> (keyingi o'rinlarda "Markaz") bir tomondan, va o'quvchining qonuniy vakili
    <b>${esc(d.parentName || "________________________")}</b> (keyingi o'rinlarda "Ota-ona") ikkinchi tomondan,
    quyidagilar haqida ushbu shartnomani tuzdilar.</p>
    <h2>1. Shartnoma predmeti</h2>
    <p>Markaz o'quvchi <b>${esc(d.studentName)}</b> uchun quyidagi kurslar bo'yicha o'quv xizmatlarini ko'rsatadi:</p>
    <table><thead><tr><th>№</th><th>Kurs / guruh</th><th style="text-align:right">Oylik to'lov</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td></td><td><b>Jami oyiga</b></td><td style="text-align:right"><b>${money(contractTotal(d.groups))}</b></td></tr></tfoot></table>
    <h2>2. To'lov tartibi</h2>
    <p>2.1. Oylik to'lov har oyning 10-sanasigacha oldindan amalga oshiriladi.<br/>
    2.2. To'lov kechiktirilganda Markaz o'quvchini darslarga qo'ymaslik huquqiga ega.<br/>
    2.3. Uzrli sabab bilan (kasallik va h.k.) o'quvchi hisobi administrator tomonidan muzlatilishi mumkin; muzlatilgan muddatda to'lov hisoblanmaydi.</p>
    <h2>3. Tomonlarning majburiyatlari</h2>
    <p>3.1. Markaz darslarni jadval asosida sifatli o'tkazadi, davomat va o'zlashtirish haqida ota-onaga ma'lumot beradi.<br/>
    3.2. Ota-ona to'lovlarni o'z vaqtida amalga oshiradi va o'quvchining darslarga muntazam qatnashishini ta'minlaydi.</p>
    <h2>4. Amal qilish muddati</h2>
    <p>Shartnoma imzolangan kundan kuchga kiradi va tomonlardan biri yozma ravishda bekor qilguncha amal qiladi.</p>
    <div class="sign">
      <div><b>MARKAZ</b><br/>${esc(d.centerName)}<br/>${esc(d.centerAddress || "")}<br/>Tel: ${esc(d.centerPhone || "")}<br/><br/>Imzo: ____________ M.O.</div>
      <div><b>OTA-ONA</b><br/>${esc(d.parentName || "")}<br/>Tel: ${esc(d.parentPhone || "")}<br/>Pasport: ______________<br/><br/>Imzo: ____________</div>
    </div>
  </section>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Shartnoma ${esc(d.number)}</title>
<style>
@page{size:A4;margin:16mm}
body{font-family:"Times New Roman",serif;font-size:12.5pt;color:#000;line-height:1.4;margin:0}
.page{page-break-after:always}.page:last-child{page-break-after:auto}
.copy{text-align:right;font-size:10pt;color:#444}
h1{font-size:14pt;text-align:center;margin:6px 0}h2{font-size:12.5pt;margin:12px 0 4px}
.meta{text-align:right;margin:0 0 8px}
table{width:100%;border-collapse:collapse;margin:6px 0}td,th{border:1px solid #000;padding:4px 6px;text-align:left}
.sign{display:flex;gap:24px;margin-top:24px}.sign>div{flex:1}
</style></head><body>${copy("1-nusxa (Markaz uchun)")}${copy("2-nusxa (Ota-ona uchun)")}</body></html>`;
}

export function printContract(d: ContractData) {
  if (typeof document === "undefined") return;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument, win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); return; }
  doc.open(); doc.write(buildContractHtml(d)); doc.close();
  setTimeout(() => { win.focus(); win.print(); setTimeout(() => frame.remove(), 60_000); }, 200);
}
