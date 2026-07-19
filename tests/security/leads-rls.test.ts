import { describe, expect, it, beforeAll } from "vitest";
import { pgAnon, requireEnv } from "./setup";

// Regression tests for finding: leads_admin_only_no_director
// Public flow: the marketing site inserts a lead as anon, but no anon or
// unauthenticated caller may read leads. Director + admin can read — that
// half is enforced by RLS and covered by the migration; we assert the
// anon-facing contract here.

describe("leads RLS: anon insert-only, no read", () => {
  beforeAll(requireEnv);

  it("blocks anonymous reads", async () => {
    const res = await pgAnon("leads?select=id&limit=1");
    // Either forbidden or empty result — both prove no data leaks.
    if (res.status === 200) {
      const rows = (await res.json()) as unknown[];
      expect(rows).toHaveLength(0);
    } else {
      expect([401, 403]).toContain(res.status);
    }
  });

  it("allows an anon insert with status=new and a valid name/phone", async () => {
    const res = await pgAnon("leads", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        name: "Test Lead",
        phone: "+998900000000",
        status: "new",
        source: "website",
      }),
    });
    expect([201, 204]).toContain(res.status);
  });

  it("rejects anon inserts that try to set status != new", async () => {
    const res = await pgAnon("leads", {
      method: "POST",
      body: JSON.stringify({
        name: "Bypass Attempt",
        phone: "+998900000001",
        status: "converted",
        source: "website",
      }),
    });
    expect([401, 403]).toContain(res.status);
  });

  it("rejects anon updates", async () => {
    const res = await pgAnon("leads?id=eq.00000000-0000-0000-0000-000000000000", {
      method: "PATCH",
      body: JSON.stringify({ status: "converted" }),
    });
    expect([401, 403, 404]).toContain(res.status);
  });
});
