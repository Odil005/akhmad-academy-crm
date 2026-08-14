import { splitTelegramMessage } from "../features/telegram/domain";

const TELEGRAM_API = "https://api.telegram.org";

export type TelegramApiResult<T = unknown> =
  { ok: true; result: T } | { ok: false; error: string; errorCode?: number; retryAfter?: number };

type TelegramEnvelope<T> = {
  ok?: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
};

export function getTelegramBotToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return token || null;
}

export async function hashTelegramLinkToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function requestTelegram<T>(
  token: string,
  method: string,
  body: unknown,
): Promise<TelegramApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as TelegramEnvelope<T>;
    if (response.ok && payload.ok && payload.result !== undefined) {
      return { ok: true, result: payload.result };
    }
    return {
      ok: false,
      error: payload.description ?? `Telegram HTTP ${response.status}`,
      errorCode: payload.error_code,
      retryAfter: payload.parameters?.retry_after,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.name === "AbortError"
          ? "Telegram javobi kechikdi"
          : "Telegram bilan aloqa xatosi",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function callTelegram<T = unknown>(
  method: string,
  body: unknown,
  token = getTelegramBotToken(),
): Promise<TelegramApiResult<T>> {
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN sozlanmagan" };
  let last: TelegramApiResult<T> = { ok: false, error: "Telegram bilan aloqa xatosi" };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    last = await requestTelegram<T>(token, method, body);
    if (last.ok) return last;

    const retryable =
      last.retryAfter !== undefined ||
      last.errorCode === undefined ||
      last.errorCode === 429 ||
      last.errorCode >= 500;
    if (!retryable || attempt === 2) return last;

    const delayMs = last.retryAfter ? Math.min(last.retryAfter, 5) * 1000 : 300 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return last;
}

export async function sendTelegramText(
  chatId: string | number,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<TelegramApiResult<unknown>> {
  let last: TelegramApiResult<unknown> = { ok: false, error: "Xabar bo'sh" };
  for (const chunk of splitTelegramMessage(text)) {
    last = await callTelegram("sendMessage", {
      chat_id: chatId,
      text: chunk,
      disable_web_page_preview: true,
      protect_content: true,
      ...extra,
    });
    if (!last.ok) return last;
  }
  return last;
}
