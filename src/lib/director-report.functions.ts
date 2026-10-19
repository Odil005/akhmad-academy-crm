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

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
    const [totals, students, groups, attendance] = await Promise.all([
      supabase.rpc('finance_context_totals', { p_since: `${today}T00:00:00+05:00` }),
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('groups').select('id', { count: 'exact', head: true }),
      supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('date', today).in('status', ['present', 'late']),
    ]);
    for (const result of [totals, students, groups, attendance]) if (result.error) throw new Error(result.error.message);
    const total = totals.data?.[0];
    const income = Number(total?.income ?? 0);
    const expense = Number(total?.expense ?? 0);
    const fmt = (value: number) => value.toLocaleString('uz-UZ');
    const { sendTelegramText } = await import("@/lib/telegram.server");
    const result = await sendTelegramText(
      rec.telegram_chat_id,
      `📊 Akhmad Academy — sinov hisoboti\n📅 ${today} (Toshkent, hozirgacha)\nQabul qiluvchi: ${rec.full_name}\n\n💰 Daromad: ${fmt(income)} so‘m\n💸 Xarajat: ${fmt(expense)} so‘m\n📈 Sof natija: ${fmt(income - expense)} so‘m\n🎓 Faol o‘quvchilar: ${students.count ?? 0}\n👥 Guruhlar: ${groups.count ?? 0}\n✅ Bugungi kelgan davomat: ${attendance.count ?? 0}`,
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
