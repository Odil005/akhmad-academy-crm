import { createFileRoute } from "@tanstack/react-router";

// Modem polls this endpoint to pick up queued outbound calls / SMS.
// GET  -> list pending items (status='queued')
// POST -> mark item done: { id, status, duration_sec?, recording_url?, notes? }

export const Route = createFileRoute("/api/public/telephony/outbox")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const secret = url.searchParams.get("secret") ?? request.headers.get("x-auth-token");
        if (!process.env.TELEPHONY_WEBHOOK_SECRET || secret !== process.env.TELEPHONY_WEBHOOK_SECRET) {
          return new Response("Unauthorized", { status: 401 });
        }
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("calls")
          .select("id, direction, phone, notes, called_at")
          .eq("status", "queued")
          .eq("direction", "outbound")
          .order("called_at", { ascending: true })
          .limit(limit);
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ items: data ?? [] });
      },
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const secret = url.searchParams.get("secret") ?? request.headers.get("x-auth-token");
        if (!process.env.TELEPHONY_WEBHOOK_SECRET || secret !== process.env.TELEPHONY_WEBHOOK_SECRET) {
          return new Response("Unauthorized", { status: 401 });
        }
        let body: Record<string, unknown> = {};
        try { body = await request.json(); } catch { /* ignore */ }
        const id = String(body.id ?? "").trim();
        if (!id) return new Response("Missing id", { status: 400 });
        const allowed = ["completed", "missed", "busy", "failed", "no_answer"];
        const status = allowed.includes(String(body.status)) ? String(body.status) : "completed";
        const duration_sec = Number(body.duration_sec ?? 0) || 0;
        const recording_url = (body.recording_url as string) ?? null;
        const notes = (body.notes as string) ?? undefined;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const patch = { status, duration_sec, recording_url, ...(notes !== undefined ? { notes } : {}) };
        const { error } = await supabaseAdmin.from("calls").update(patch).eq("id", id);
        if (error) return new Response(error.message, { status: 500 });
        return new Response("ok");
      },
    },
  },
});
