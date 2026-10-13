import { createFileRoute } from "@tanstack/react-router";
import { isCronRequestAuthorized, unauthorizedCronResponse } from "@/lib/cron-auth.server";

async function run(request: Request): Promise<Response> {
  if (!isCronRequestAuthorized(request)) return unauthorizedCronResponse();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("generate_monthly_invoices", {});
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, result: data?.[0] ?? null });
}

export const Route = createFileRoute("/api/public/cron/monthly-invoices")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});
