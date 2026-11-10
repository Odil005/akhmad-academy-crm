import { describe, expect, it } from "vitest";
import { signInitData, verifyInitData } from "../src/lib/telegram-webapp";

const TOKEN = "123456:TEST";
const now = 1_800_000_000;

async function build(fields: Record<string, string>, token = TOKEN) {
  const hash = await signInitData(fields, token);
  return new URLSearchParams({ ...fields, hash }).toString();
}

describe("Telegram Mini App initData", () => {
  const user = JSON.stringify({ id: 42, first_name: "Ali" });

  it("accepts a correctly signed fresh payload", async () => {
    const data = await build({ auth_date: String(now - 60), user });
    expect((await verifyInitData(data, TOKEN, now))?.id).toBe(42);
  });

  it("rejects a payload signed with another bot token", async () => {
    const data = await build({ auth_date: String(now - 60), user }, "999:OTHER");
    expect(await verifyInitData(data, TOKEN, now)).toBeNull();
  });

  it("rejects a tampered user id", async () => {
    const data = await build({ auth_date: String(now - 60), user });
    const tampered = data.replace("%3A42", "%3A43");
    expect(await verifyInitData(tampered, TOKEN, now)).toBeNull();
  });

  it("rejects payloads older than 24 hours", async () => {
    const data = await build({ auth_date: String(now - 25 * 3600), user });
    expect(await verifyInitData(data, TOKEN, now)).toBeNull();
  });
});
