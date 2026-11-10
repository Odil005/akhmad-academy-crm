import { describe, expect, it } from "vitest";
import { examLevel, examPercent } from "../src/lib/exam-score";

describe("imtihon bali", () => {
  it("foizga aylanadi", () => expect(examPercent(45, 50)).toBe(90));
  it("maksimaldan oshmaydi", () => expect(examPercent(120, 100)).toBe(100));
  it("86% va yuqori a'lo", () => expect(examLevel(86)).toBe("A'lo"));
  it("55% qoniqarsiz", () => expect(examLevel(55)).toBe("Qoniqarsiz"));
});
