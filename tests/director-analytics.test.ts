import { describe, it, expect } from "vitest";
import { churnRate, netGrowth, pct, rangeFor } from "../src/lib/director-analytics";

describe("director analytics", () => {
  it("guruh to'liqligi foizi", () => {
    expect(pct(12, 15)).toBe(80);
    expect(pct(3, 0)).toBe(0);
  });
  it("sof o'sish = yangi - ketgan", () => {
    expect(netGrowth({ new_students: 20, left_students: 7 })).toBe(13);
  });
  it("ketish darajasi", () => {
    expect(churnRate({ active_students: 90, left_students: 10 })).toBe(10);
  });
  it("o'tgan oy chegaralari", () => {
    expect(rangeFor("last_month", new Date(2026, 10, 17))).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(rangeFor("this_month", new Date(2026, 10, 17))).toEqual({ from: "2026-11-01", to: "2026-11-17" });
  });
});
