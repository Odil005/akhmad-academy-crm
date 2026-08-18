// Shared test helpers hitting the running dev server and PostgREST.
// The dev server runs on http://localhost:8080 with runtime secrets injected.

export const APP_URL = process.env.TEST_APP_URL ?? "http://localhost:8080";
export const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  "";
export const SUPABASE_ANON_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "";
/**
 * CI (GitHub Actions) runs with placeholder Supabase values and no dev server,
 * so the integration suites below must be skipped there instead of failing.
 */
export const hasLiveBackend =
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) &&
  !SUPABASE_URL.includes("example.supabase.co") &&
  !SUPABASE_ANON_KEY.includes("placeholder");

export const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";

export function requireEnv(): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY missing in test env");
  }
}

/** Send a Telegram-style POST to our webhook. */
export async function postTelegram(
  body: unknown,
  { secret = TELEGRAM_WEBHOOK_SECRET }: { secret?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret) headers["x-telegram-bot-api-secret-token"] = secret;
  return fetch(`${APP_URL}/api/public/telegram/webhook`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export function telegramUpdate(text: string, chatId = 999_000_001) {
  return {
    update_id: Math.floor(Math.random() * 1e9),
    message: {
      message_id: 1,
      chat: { id: chatId, type: "private" },
      text,
    },
  };
}

/** Call PostgREST as the anon role. */
export async function pgAnon(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "content-type": "application/json",
      Accept: "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}
