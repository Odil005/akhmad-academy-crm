import { describe, expect, it, beforeAll } from "vitest";
import { pgAnon, requireEnv } from "./setup";

// Regression test for finding: settings_public_key_scoping
// Anonymous readers must only see settings rows explicitly flagged
// is_public=true. Any other row (e.g. a staff-only key that happens to be
// named 'contact_info' or 'homepage_stats' on a future insert) must NOT
// leak via the public read policy.

describe("settings RLS: public reads require is_public=true", () => {
  beforeAll(requireEnv);

  it("returns only is_public rows for anon", async () => {
    const res = await pgAnon("settings?select=key,is_public");
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<{ key: string; is_public: boolean }>;
    for (const r of rows) expect(r.is_public).toBe(true);
  });

  it("blocks anon writes to settings", async () => {
    const res = await pgAnon("settings", {
      method: "POST",
      body: JSON.stringify({ key: `test_${Date.now()}`, value: {}, is_public: true }),
    });
    // RLS / grants refuse; PostgREST returns 400/401/403 depending on layer.
    expect(res.ok).toBe(false);
    expect([400, 401, 403]).toContain(res.status);
  });
});

