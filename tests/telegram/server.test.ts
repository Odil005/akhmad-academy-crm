import { afterEach, describe, expect, it, vi } from "vitest";
import { callTelegram, sendTelegramText } from "../../src/lib/telegram.server";

const originalBotToken = process.env.TELEGRAM_BOT_TOKEN;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("Telegram server client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalBotToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalBotToken;
  });

  it("retries a temporary Telegram failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ ok: false, error_code: 500, description: "temporary" }, 500),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true, result: { id: 1 } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callTelegram<{ id: number }>("getMe", {}, "test-token");

    expect(result).toEqual({ ok: true, result: { id: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a permanent client error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ ok: false, error_code: 400, description: "bad request" }, 400),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callTelegram("sendMessage", {}, "test-token");

    expect(result).toMatchObject({ ok: false, errorCode: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("protects CRM messages from forwarding", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, result: true }));
    vi.stubGlobal("fetch", fetchMock);

    await sendTelegramText("123456", "Maxfiy o'quvchi ma'lumoti");

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({ protect_content: true });
  });
});
