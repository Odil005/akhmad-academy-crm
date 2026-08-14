import { describe, expect, it } from "vitest";
import {
  isJarvisSafeSettingKey,
  sanitizeJarvisSettingValues,
} from "../../src/features/jarvis/settings";

describe("Jarvis safe settings", () => {
  it("accepts only allow-listed non-secret settings", () => {
    expect(isJarvisSafeSettingKey("contact_info")).toBe(true);
    expect(isJarvisSafeSettingKey("sms_provider")).toBe(false);
    expect(isJarvisSafeSettingKey("user_roles")).toBe(false);
  });

  it("drops unknown fields and caps values", () => {
    expect(
      sanitizeJarvisSettingValues("contact_info", {
        phone: " +998 90 123 45 67 ",
        api_key: "must-not-pass",
      }),
    ).toEqual({ phone: "+998 90 123 45 67" });
  });

  it("rejects empty or unsafe updates", () => {
    expect(sanitizeJarvisSettingValues("sms_provider", { api_key: "secret" })).toBeNull();
    expect(sanitizeJarvisSettingValues("homepage_stats", { secret: "x" })).toBeNull();
  });
});
