import { describe, expect, it } from "vitest";
import { buildReceipt58Html, receiptPeriod, receiptTotal } from "../src/lib/receipt-58";

describe("58 mm chek", () => {
  it("jami summa = summa - chegirma, manfiy bo'lmaydi", () => {
    expect(receiptTotal(500000, 50000)).toBe(450000);
    expect(receiptTotal(100000, 200000)).toBe(0);
  });
  it("chek 58 mm qog'ozga mo'ljallangan va jami summani ko'rsatadi", () => {
    const html = buildReceipt58Html({
      centerName: "Akhmad Academy", receiptNo: "AB12CD34", date: new Date(2026, 10, 9, 14, 5),
      studentName: "Ali <Valiyev>", periodMonth: "2026-11-01", subtotal: 500000, discount: 50000, method: "card",
    });
    expect(html).toContain("size: 58mm auto");
    expect(html).toContain("450 000 so'm");
    expect(html).toContain("Ali &lt;Valiyev&gt;");
    expect(html).toContain("Bank kartasi");
  });
  it("davr oy nomi bilan yoziladi", () => {
    expect(receiptPeriod("2026-11-01")).toBe("Noyabr 2026");
  });
});
