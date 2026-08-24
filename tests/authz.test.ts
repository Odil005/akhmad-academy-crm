import { describe, expect, it } from "vitest";
import { canManageAccount, canManageSchedule, manageableAccountRoles } from "../src/lib/authz";

describe("central role rules", () => {
  it("lets an administrator manage only teacher and student accounts", () => {
    expect(canManageAccount(["admin"], "student")).toBe(true);
    expect(canManageAccount(["admin"], "teacher")).toBe(true);
    expect(canManageAccount(["admin"], "admin")).toBe(true);
    expect(canManageAccount(["admin"], "director")).toBe(true);
    expect(manageableAccountRoles(["admin"])).toEqual(["student", "teacher", "admin", "director"]);
  });

  it("reserves privileged account management for a director", () => {
    expect(canManageAccount(["director"], "admin")).toBe(true);
    expect(canManageAccount(["director"], "director")).toBe(true);
  });

  it("permits schedule changes only for staff", () => {
    expect(canManageSchedule(["director"])).toBe(true);
    expect(canManageSchedule(["admin"])).toBe(true);
    expect(canManageSchedule(["teacher"])).toBe(false);
    expect(canManageSchedule(["student"])).toBe(false);
  });
});
