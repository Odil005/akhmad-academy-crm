import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Staff-only: send a verification message to one director-report recipient.
 * Confirms the stored chat id actually reachable by the bot before 21:00 cron.
 */
export const sendDirectorReportTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ recipientId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    if (!roles.includes("director") && !roles.includes("admin")) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { data: rec } = await supabase
      .from("director_report_recipients")
      .select("id, full_name, telegram_chat_id")
      .eq("id", data.recipientId)
      .maybeSingle();
    if (!rec?.telegram_chat_id) return { ok: false as const, error: "Chat ID topilmadi" };

    const { sendTelegramText } = await import("@/lib/telegram.server");
    const result = await sendTelegramText(
      rec.telegram_chat_id,
      `✅ Akhmad Academy: kunlik direktor hisoboti uchun ulanish tasdiqlandi.\nQabul qiluvchi: ${rec.full_name}\nHisobot har kuni 21:00 (Toshkent) da shu chatga keladi.`,
    );
    if (result.ok) return { ok: true as const };
    const error = result.error;
    return {
      ok: false as const,
      error:
        error === "Bad Request: chat not found"
          ? "Chat topilmadi — avval botga /start yuborilishi kerak"
          : error === "Forbidden: bot was blocked by the user"
            ? "Bot bloklangan — blokdan chiqaring"
            : error,
    };
  });
