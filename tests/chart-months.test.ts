import { describe, expect, it } from "vitest";
import { chartMonths } from "../src/lib/chart-months";

describe("chart month intervals", () => {
  it("provides six complete adjacent intervals across a year boundary", () => {
    const months = chartMonths(new Date(2026, 0, 28));
    expect(months.map(d => [d.getFullYear(), d.getMonth(), d.getDate()])).toEqual([
      [2025, 7, 1], [2025, 8, 1], [2025, 9, 1], [2025, 10, 1],
      [2025, 11, 1], [2026, 0, 1], [2026, 1, 1],
    ]);
  });
});