import { describe, expect, it, beforeAll } from "vitest";
import { postTelegram, telegramUpdate, requireEnv, TELEGRAM_WEBHOOK_SECRET, hasLiveBackend, pgAnon } from "./setup";

// Bot menu regression tests: the webhook returns 200 for menu button texts
// without linking, and refuses to expose data to un-linked chats.

describe.skipIf(!TELEGRAM_WEBHOOK_SECRET || !hasLiveBackend)("Telegram bot: parent menu", () => {
  beforeAll(() => {
    requireEnv();
  });

  it("requires the shared secret", async () => {
    const res = await postTelegram(telegramUpdate("🏠 Bosh menyu"), { secret: "wrong" });
    expect(res.status).toBe(401);
  });

  it("accepts menu button text with valid secret (returns 200)", async () => {
    for (const btn of [
      "🏠 Bosh menyu",
      "👨‍🏫 O'qituvchiga yozish",
      "💬 O'qituvchi javoblari",
      "📅 Uchrashuv so'rash",
      "📝 O'qituvchi fikri",
      "💳 To'lov holati",
      "📊 Davomat va natijalar",
    ]) {
      const res = await postTelegram(telegramUpdate(btn));
      expect(res.status).toBe(200);
    }
  });

  it("does not expose parent_teacher_messages or payment_notifications to anon", async () => {
    const a = await pgAnon("parent_teacher_messages?select=id&limit=1");
    // Either 401 (no grants) or 200 with [] under RLS — but never a leak.
    if (a.ok) expect(await a.json()).toEqual([]);
    const b = await pgAnon("payment_notifications?select=id&limit=1");
    if (b.ok) expect(await b.json()).toEqual([]);
  });
});
