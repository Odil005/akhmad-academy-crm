import { createFileRoute } from "@tanstack/react-router";
import { isCronRequestAuthorized, unauthorizedCronResponse } from "@/lib/cron-auth.server";

/**
 * Retry pending payment-receipt notifications (notification_queue).
 * Secured with CRON_SECRET; call every few minutes.
 */
export const Route = createFileRoute("/api/public/cron/receipt-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isCronRequestAuthorized(request)) return unauthorizedCronResponse();

        const { createClient } = await import("@supabase/supabase-js");
        const admin = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            auth: { persistSession: false },
          },
        );

        const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
        if (!token)
          return Response.json({ ok: false, error: "bot token missing" }, { status: 200 });

        const { data: rows } = await admin
          .from("notification_queue")
          .select("id, telegram_chat_id, message_text, attempts")
          .eq("status", "pending")
          .lt("attempts", 8)
          .not("telegram_chat_id", "is", null)
          .limit(30);

        let sent = 0;
        const { sendTelegramText } = await import("@/lib/telegram.server");
        for (const row of (rows ?? []) as {
          id: string;
          telegram_chat_id: string;
          message_text: string;
          attempts: number;
        }[]) {
          const result = await sendTelegramText(row.telegram_chat_id, row.message_text);
          const ok = result.ok;
          const err = result.ok ? undefined : result.error;
          if (ok) sent++;
          await admin
            .from("notification_queue")
            .update({
              status: ok ? "sent" : "pending",
              attempts: (row.attempts ?? 0) + 1,
              last_error: ok ? null : (err ?? "unknown"),
              sent_at: ok ? new Date().toISOString() : null,
            })
            .eq("id", row.id);
        }

        return Response.json({ ok: true, processed: (rows ?? []).length, sent });
      },
    },
  },
});
