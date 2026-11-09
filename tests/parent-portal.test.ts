import { describe, expect, it } from "vitest";
import { isParentOnly, normalizeParentPhone, parentCodeHash, PARENT_CODE_LIMITS } from "../src/lib/parent-portal";

describe("parent sign-in rules", () => {
  it("matches parent phones by the last 9 digits", () => {
    expect(normalizeParentPhone("+998 (91) 970-27-92")).toBe("919702792");
    expect(normalizeParentPhone("919702792")).toBe("919702792");
  });

  it("codes expire after 5 minutes and allow 5 attempts", () => {
    expect(PARENT_CODE_LIMITS.ttlMinutes).toBe(5);
    expect(PARENT_CODE_LIMITS.maxAttempts).toBe(5);
  });

  it("allows at most 3 codes per phone in 10 minutes", () => {
    expect(PARENT_CODE_LIMITS.maxCodesPerWindow).toBe(3);
    expect(PARENT_CODE_LIMITS.windowMinutes).toBe(10);
  });

  it("keeps parent-only accounts out of the staff CRM", () => {
    expect(isParentOnly(["parent"])).toBe(true);
    expect(isParentOnly(["parent", "admin"])).toBe(false);
    expect(isParentOnly([])).toBe(false);
  });

  it("binds the code hash to the phone", async () => {
    expect(await parentCodeHash("919702792", "123456")).not.toBe(await parentCodeHash("901112233", "123456"));
  });
});
