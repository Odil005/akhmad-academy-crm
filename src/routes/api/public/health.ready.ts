import { createFileRoute } from "@tanstack/react-router";

/**
 * Readiness: can this origin actually serve traffic?
 * Performs a cheap, anon-scoped database round-trip. Returns no secrets,
 * no connection strings and no row data — only a status and latency.
 */
export const Route = createFileRoute("/api/public/health/ready")({
  server: {
    handlers: {
      GET: async () => {
        const requestId = crypto.randomUUID();
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        const headers = {
          "content-type": "application/json",
          "cache-control": "no-store",
          "x-request-id": requestId,
        };

        if (!url || !key) {
          return new Response(
            JSON.stringify({ status: "not_ready", checks: { config: "missing" }, request_id: requestId }),
            { status: 503, headers },
          );
        }

        const started = Date.now();
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3000);
          const resp = await fetch(`${url}/rest/v1/settings?select=key&limit=1`, {
            headers: { apikey: key, authorization: `Bearer ${key}` },
            signal: controller.signal,
          });
          clearTimeout(timer);
          const latency = Date.now() - started;
          const dbOk = resp.status < 500;
          return new Response(
            JSON.stringify({
              status: dbOk ? "ready" : "not_ready",
              checks: { database: dbOk ? "ok" : "error" },
              latency_ms: latency,
              request_id: requestId,
            }),
            { status: dbOk ? 200 : 503, headers },
          );
        } catch {
          return new Response(
            JSON.stringify({
              status: "not_ready",
              checks: { database: "unreachable" },
              latency_ms: Date.now() - started,
              request_id: requestId,
            }),
            { status: 503, headers },
          );
        }
      },
    },
  },
});
