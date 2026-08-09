import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Staff-only: send a verification message to one director-report recipient.
 * Confirms the stored chat id actually reachable by the bot before 20:00 cron.
 */
export const sendDirectorReportTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ recipientId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
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

    const token = process.env["TELEGRAM_BOT_TOKEN"];
    if (!token) return { ok: false as const, error: "Bot tokeni sozlanmagan" };

    try {
      const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: rec.telegram_chat_id,
          text: `✅ Akhmad Academy: kunlik direktor hisoboti uchun ulanish tasdiqlandi.\nQabul qiluvchi: ${rec.full_name}\nHisobot har kuni 20:00 (Toshkent) da shu chatga keladi.`,
        }),
      });
      const body = (await resp.json().catch(() => ({}))) as { ok?: boolean; description?: string };
      if (body.ok === true) return { ok: true as const };
      const d = body.description ?? `HTTP ${resp.status}`;
      return {
        ok: false as const,
        error:
          d === "Bad Request: chat not found"
            ? "Chat topilmadi — avval botga /start yuborilishi kerak"
            : d === "Forbidden: bot was blocked by the user"
              ? "Bot bloklangan — blokdan chiqaring"
              : d,
      };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Tarmoq xatosi" };
    }
  });
