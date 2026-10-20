import { describe, expect, it } from "vitest";
import { normalizeHost } from "../src/lib/tenant.functions";

describe("normalizeHost", () => {
  it("strips www, port and casing so ilmnuri.xyz matches its center", () => {
    expect(normalizeHost("WWW.IlmNuri.xyz:443")).toBe("ilmnuri.xyz");
  });
  it("uses the first forwarded host", () => {
    expect(normalizeHost("ilmnuri.xyz, proxy.internal")).toBe("ilmnuri.xyz");
  });
});
