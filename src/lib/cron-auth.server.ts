function constantTimeEquals(left: string, right: string): boolean {
  const max = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let i = 0; i < max; i += 1) {
    mismatch |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

export function isCronRequestAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (secret.length < 16) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const legacyHeader = request.headers.get("x-cron-secret") ?? "";
  return (
    constantTimeEquals(authorization, `Bearer ${secret}`) ||
    constantTimeEquals(legacyHeader, secret)
  );
}

export function unauthorizedCronResponse(): Response {
  return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
