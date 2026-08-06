import { createFileRoute } from "@tanstack/react-router";

/** Liveness: the server process is running. No secrets, no dependencies. */
export const Route = createFileRoute("/api/public/health/live")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ status: "live", ts: new Date().toISOString() }), {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        }),
    },
  },
});
