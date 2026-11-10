function constantTimeEquals(left: string, right: string): boolean {
  const max = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let i = 0; i < max; i += 1) {
    mismatch |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

/**
 * Scheduled jobs authenticate with either the CRON_SECRET env value or the
 * database-held shared secret that pg_cron sends in `x-cron-secret`.
 */
export async function isCronRequestAuthorized(request: Request): Promise<boolean> {
  const authorization = request.headers.get("authorization") ?? "";
  const headerSecret = (request.headers.get("x-cron-secret") ?? "").trim();

  const envSecret = process.env.CRON_SECRET?.trim() ?? "";
  if (envSecret.length >= 16) {
    if (
      constantTimeEquals(authorization, `Bearer ${envSecret}`) ||
      constantTimeEquals(headerSecret, envSecret)
    ) {
      return true;
    }
  }

  const candidate =
    headerSecret || (authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "");
  if (candidate.length < 32) return false;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("verify_cron_secret", {
      p_secret: candidate,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

export function unauthorizedCronResponse(): Response {
  return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
