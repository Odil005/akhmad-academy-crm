import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Send a Telegram message to a student's linked parent chat.
 * Staff (director/admin) or the student's teacher can call this.
 * Logs the attempt into `parent_notifications`.
 */
export const sendParentTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        student_id: z.string().uuid(),
        text: z.string().min(1).max(4000),
        kind: z.string().default("manual"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorization: staff always; teacher only if student is in their group
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesData ?? []).map((r) => r.role as string);
    const isStaff = roles.includes("director") || roles.includes("admin");
    const isTeacher = roles.includes("teacher");
    if (!isStaff && !isTeacher) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: student, error: sErr } = await supabaseAdmin
      .from("students")
      .select("id, group_id, parent_telegram_chat_id, parent_notifications_enabled")
      .eq("id", data.student_id)
      .maybeSingle();
    if (sErr || !student) throw new Response("O'quvchi topilmadi", { status: 404 });

    if (!isStaff && isTeacher) {
      // teacher must own a lesson for that group
      const { data: allowed } = await supabaseAdmin
        .from("lessons")
        .select("id")
        .eq("teacher_user_id", userId)
        .eq("group_id", student.group_id ?? "")
        .limit(1);
      if (!allowed || allowed.length === 0) throw new Response("Forbidden", { status: 403 });
    }

    if (!student.parent_notifications_enabled || !student.parent_telegram_chat_id) {
      await supabaseAdmin.from("parent_notifications").insert({
        student_id: data.student_id,
        kind: data.kind,
        channel: "telegram",
        payload: { text: data.text },
        status: "skipped",
        error: "Chat ID mavjud emas yoki bildirishnomalar o'chirilgan",
      });
      return { ok: false, reason: "no_chat" as const };
    }

    if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
      await supabaseAdmin.from("parent_notifications").insert({
        student_id: data.student_id,
        kind: data.kind,
        channel: "telegram",
        payload: { text: data.text },
        status: "error",
        error: "Bot token sozlanmagan",
      });
      throw new Response("Telegram bot token sozlanmagan (/settings/integrations)", {
        status: 400,
      });
    }

    const { sendTelegramText } = await import("@/lib/telegram.server");
    const result = await sendTelegramText(student.parent_telegram_chat_id, data.text);

    await supabaseAdmin.from("parent_notifications").insert({
      student_id: data.student_id,
      kind: data.kind,
      channel: "telegram",
      payload: { text: data.text },
      status: result.ok ? "sent" : "error",
      error: result.ok ? null : result.error,
      sent_at: result.ok ? new Date().toISOString() : null,
    });

    if (!result.ok) throw new Response(result.error, { status: 502 });
    return { ok: true as const };
  });
