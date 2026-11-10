/** Telegram Mini App initData verification (pure, Web Crypto — works on workerd and Node). */
export type TelegramWebAppUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
};

const enc = new TextEncoder();

async function hmac(key: BufferSource, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(msg));
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Builds the hash Telegram would send for these fields (used by tests and verification). */
export async function signInitData(fields: Record<string, string>, botToken: string): Promise<string> {
  const check = Object.keys(fields)
    .filter((k) => k !== "hash")
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = await hmac(enc.encode("WebAppData"), botToken);
  return toHex(await hmac(secret, check));
}

export const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;

/** Returns the Telegram user when the signature is valid and fresh; otherwise null. */
export async function verifyInitData(
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<TelegramWebAppUser | null> {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  const fields: Record<string, string> = {};
  params.forEach((v, k) => {
    if (k !== "hash") fields[k] = v;
  });
  const expected = await signInitData(fields, botToken);
  if (expected.length !== hash.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ hash.charCodeAt(i);
  if (diff !== 0) return null;
  const authDate = Number(fields.auth_date);
  if (!Number.isFinite(authDate) || nowSeconds - authDate > INIT_DATA_MAX_AGE_SECONDS) return null;
  try {
    const user = JSON.parse(fields.user ?? "null") as TelegramWebAppUser | null;
    return user && typeof user.id === "number" ? user : null;
  } catch {
    return null;
  }
}
