import { describe, expect, it, vi } from "vitest";
import { createInFlightReads } from "../src/lib/in-flight-reads";

describe("in-flight reads", () => {
  it("shares overlapping reads but always fetches again after settlement", async () => {
    const run = createInFlightReads<number>();
    const read = vi.fn(async () => 12);
    const a = run("user-a", read);
    const b = run("user-a", read);
    expect(a).toBe(b);
    expect(await a).toBe(12);
    expect(read).toHaveBeenCalledTimes(1);
    await run("user-a", read);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("never shares data between identities", async () => {
    const run = createInFlightReads<number>();
    expect(await Promise.all([run("a", async () => 1), run("b", async () => 2)])).toEqual([1, 2]);
  });
  it("allows a fresh retry after a failed read", async () => {
    const run = createInFlightReads<number>();
    await expect(run("a", async () => { throw new Error("offline"); })).rejects.toThrow("offline");
    expect(await run("a", async () => 3)).toBe(3);
  });
});