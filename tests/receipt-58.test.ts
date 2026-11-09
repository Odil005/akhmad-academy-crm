import { describe, expect, it } from "vitest";
import { buildReceipt58Html, receiptNextDue, receiptPeriod, receiptTotal } from "../src/lib/receipt-58";

describe("58 mm chek (to'liq namuna)", () => {
  it("jami summa = summa - chegirma, manfiy bo'lmaydi", () => {
    expect(receiptTotal(500000, 50000)).toBe(450000);
    expect(receiptTotal(100000, 200000)).toBe(0);
  });
  it("keyingi to'lov keyingi oyning 10-sanasi", () => {
    expect(receiptNextDue("2026-11-01")).toBe("2026-12-10");
    expect(receiptNextDue("2026-12-01")).toBe("2027-01-10");
  });
  it("chek 58 mm, jami, qolgan qarz va imzo joyi bilan", () => {
    const html = buildReceipt58Html({
      centerName: "Akhmad Academy", receiptNo: "AB12CD34", date: new Date(2026, 10, 9, 14, 5),
      studentName: "Ali <Valiyev>", periodMonth: "2026-11-01", subtotal: 500000, discount: 50000, method: "card",
      debtLeft: 0, nextDue: "2026-12-10", teacherName: "Maftuna A.", parentPhone: "+998911234567",
    });
    expect(html).toContain("size: 58mm auto");
    expect(html).toContain("450 000 so'm");
    expect(html).toContain("Ali &lt;Valiyev&gt;");
    expect(html).toContain("Qolgan qarz");
    expect(html).toContain("10.12.2026");
    expect(html).toContain("Imzo:");
  });
  it("davr oy nomi bilan yoziladi", () => {
    expect(receiptPeriod("2026-11-01")).toBe("Noyabr 2026");
  });
});
