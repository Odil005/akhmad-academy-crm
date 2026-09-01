/**
 * Runtime environment normalizer.
 *
 * Some hosts (Cloudflare Workers) deliver configuration on the request `env`
 * object instead of `process.env`, and external builders (Vercel / Render /
 * Cloudflare) never receive Lovable's SUPABASE_* injection. Server functions
 * read `process.env`, so we mirror everything there once per worker instance.
 *
 * Only public browser credentials have build-time fallbacks; the service role
 * key must always come from a real secret.
 */

const PUBLIC_URL_FALLBACK = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const PUBLIC_KEY_FALLBACK = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

type EnvRecord = Record<string, string | undefined>;

function processEnv(): EnvRecord | undefined {
  const proc = (globalThis as { process?: { env?: EnvRecord } }).process;
  return proc?.env;
}

/** Copies string values from a host-provided env object into process.env. */
export function adoptHostEnv(hostEnv: unknown): void {
  const target = processEnv();
  if (!target || !hostEnv || typeof hostEnv !== "object") return;
  for (const [key, value] of Object.entries(hostEnv as EnvRecord)) {
    if (typeof value === "string" && value !== "" && !target[key]) {
      target[key] = value;
    }
  }
}

/** Fills the public Supabase variables when the host did not provide them. */
export function ensureSupabaseServerEnv(): void {
  const env = processEnv();
  if (!env) return;

  if (!env.SUPABASE_URL) {
    env.SUPABASE_URL = env.VITE_SUPABASE_URL || PUBLIC_URL_FALLBACK;
  }
  if (!env.SUPABASE_PUBLISHABLE_KEY) {
    env.SUPABASE_PUBLISHABLE_KEY =
      env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || PUBLIC_KEY_FALLBACK;
  }
}

/** Single entry point used by the server entry on every request. */
export function normalizeServerEnv(hostEnv?: unknown, requestUrl?: string): void {
  adoptHostEnv(hostEnv);
  ensureSupabaseServerEnv();

  // Public base URL: hosts rarely set it, but Telegram/webhook/receipt links
  // need an absolute HTTPS origin. Derive it from the incoming request.
  const env = processEnv();
  if (env && !env.APP_BASE_URL && requestUrl) {
    try {
      const origin = new URL(requestUrl).origin;
      if (origin.startsWith("https://")) env.APP_BASE_URL = origin;
    } catch {
      /* ignore malformed request URLs */
    }
  }
}
