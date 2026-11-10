import { describe, expect, it } from "vitest";
import { buildContractHtml, contractTotal } from "../src/lib/contract-print";

describe("shartnoma", () => {
  it("oylik jami barcha guruhlar yig'indisi", () => {
    expect(contractTotal([{ fee: 400000 }, { fee: 350000 }])).toBe(750000);
  });
  it("ikki nusxada chiqadi", () => {
    const html = buildContractHtml({ centerName: "A", centerPhone: null, centerAddress: null, studentName: "S", studentPhone: null, parentName: null, parentPhone: null, groups: [], date: new Date(), number: "X" });
    expect(html).toContain("1-nusxa");
    expect(html).toContain("2-nusxa");
  });
});
