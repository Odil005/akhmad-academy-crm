import { describe, expect, it } from "vitest";
import { isTeacherOnly } from "../src/lib/role-home";

describe("teacher landing page", () => {
  it("sends plain teachers to the teacher panel", () => {
    expect(isTeacherOnly(["teacher"])).toBe(true);
    expect(isTeacherOnly(["teacher", "student"])).toBe(true);
  });

  it("keeps directors and admins on the dashboard", () => {
    expect(isTeacherOnly(["teacher", "director"])).toBe(false);
    expect(isTeacherOnly(["teacher", "admin"])).toBe(false);
    expect(isTeacherOnly(["student"])).toBe(false);
  });
});
