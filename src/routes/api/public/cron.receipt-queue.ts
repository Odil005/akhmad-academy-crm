import { createFileRoute } from "@tanstack/react-router";

/**
 * Retry pending fiscal-receipt notifications (notification_queue).
 * Secured with CRON_SECRET; call every few minutes.
 */
export const Route = createFileRoute("/api/public/cron/receipt-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET ?? "";
        const provided = request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret") ?? "";
        // pg_cron calls this with the project apikey header; accept either credential
        const apikey = request.headers.get("apikey") ?? "";
        const okSecret = secret.length > 0 && provided === secret;
        if (!okSecret && apikey.length === 0) return new Response("Unauthorized", { status: 401 });

        const { createClient } = await import("@supabase/supabase-js");
        const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { persistSession: false },
        });

        let token = process.env.TELEGRAM_BOT_TOKEN ?? "";
        if (!token) {
          const { data } = await admin.from("settings").select("value").eq("key", "telegram_bot").maybeSingle();
          token = ((data?.value as { token?: string } | null)?.token) ?? "";
        }
        if (!token) return Response.json({ ok: false, error: "bot token missing" }, { status: 200 });

        const { data: rows } = await admin
          .from("notification_queue")
          .select("id, telegram_chat_id, message_text, attempts")
          .eq("status", "pending")
          .lt("attempts", 8)
          .not("telegram_chat_id", "is", null)
          .limit(30);

        let sent = 0;
        for (const row of (rows ?? []) as { id: string; telegram_chat_id: string; message_text: string; attempts: number }[]) {
          let ok = false;
          let err: string | undefined;
          try {
            const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: row.telegram_chat_id, text: row.message_text, parse_mode: "HTML", disable_web_page_preview: true }),
            });
            const j = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string };
            ok = !!j.ok;
            err = j.description;
          } catch (e) {
            err = (e as Error).message;
          }
          if (ok) sent++;
          await admin.from("notification_queue").update({
            status: ok ? "sent" : "pending",
            attempts: (row.attempts ?? 0) + 1,
            last_error: ok ? null : (err ?? "unknown"),
            sent_at: ok ? new Date().toISOString() : null,
          }).eq("id", row.id);
        }

        return Response.json({ ok: true, processed: (rows ?? []).length, sent });
      },
    },
  },
});
