import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const KIND = z.enum(["student", "profile"]);

const chatIdSchema = z
  .string()
  .trim()
  .regex(/^\d{5,20}$/, "Telegram ID faqat raqamlardan iborat bo'lishi kerak (@username emas)");

const usernameSchema = z
  .string()
  .trim()
  .regex(/^@?[A-Za-z0-9_]{4,32}$/, "Username formati noto'g'ri")
  .transform((v) => (v.startsWith("@") ? v : `@${v}`));

async function rolesOf(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: { role: string }) => r.role);
}

/** Staff (director/admin) may edit anyone; a user may edit their own profile row. */
function assertCanEdit(
  kind: "student" | "profile",
  subjectId: string,
  userId: string,
  roles: string[],
) {
  const staff = roles.includes("director") || roles.includes("admin");
  if (staff) return;
  if (kind === "profile" && subjectId === userId) return;
  throw new Response("Forbidden", { status: 403 });
}

async function audit(
  supabase: any,
  row: {
    subject_kind: string;
    subject_id: string;
    action: string;
    chat_id: string | null;
    success: boolean;
    error?: string | null;
    actor_id: string;
  },
) {
  await supabase.from("telegram_audit_log").insert(row);
}

/** Save (or clear) a personal Telegram chat id + optional username on a profile or student. */
export const saveTelegramId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        kind: KIND,
        subjectId: z.string().uuid(),
        chatId: z
          .union([chatIdSchema, z.literal("")])
          .nullable()
          .optional(),
        username: z
          .union([usernameSchema, z.literal("")])
          .nullable()
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesOf(supabase, userId);
    assertCanEdit(data.kind, data.subjectId, userId, roles);

    const chatId = data.chatId ? data.chatId : null;
    const username = data.username ? data.username : null;
    const table = data.kind === "student" ? "students" : "profiles";

    const { error } = await supabase
      .from(table)
      .update({
        telegram_chat_id: chatId,
        telegram_username: username,
        telegram_verified_at: null,
        telegram_last_error: null,
      })
      .eq("id", data.subjectId);

    await audit(supabase, {
      subject_kind: data.kind,
      subject_id: data.subjectId,
      action: "save",
      chat_id: chatId,
      success: !error,
      error: error?.message ?? null,
      actor_id: userId,
    });

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/** Send a verification message through the bot; marks the record verified on success. */
export const sendTelegramTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ kind: KIND, subjectId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesOf(supabase, userId);
    assertCanEdit(data.kind, data.subjectId, userId, roles);

    const table = data.kind === "student" ? "students" : "profiles";
    const { data: row } = await supabase
      .from(table)
      .select("telegram_chat_id")
      .eq("id", data.subjectId)
      .maybeSingle();

    const chatId: string | null =
      (row as { telegram_chat_id?: string | null } | null)?.telegram_chat_id ?? null;
    if (!chatId) return { ok: false as const, error: "Telegram ID saqlanmagan" };

    const { sendTelegramText } = await import("@/lib/telegram.server");
    const result = await sendTelegramText(
      chatId,
      "✅ Akhmad Academy: Telegram ulanishi tasdiqlandi. Bundan keyin davomat, to'lov va jadval xabarlari shu chatga keladi.",
    );
    const ok = result.ok;
    const rawError = result.ok ? null : result.error;
    const err =
      rawError === "Forbidden: bot was blocked by the user"
        ? "Bot bloklangan — foydalanuvchi botni blokdan chiqarsin"
        : rawError === "Bad Request: chat not found"
          ? "Chat topilmadi — avval botga /start yuborilishi kerak"
          : rawError;

    await supabase
      .from(table)
      .update({
        telegram_verified_at: ok ? new Date().toISOString() : null,
        telegram_last_checked_at: new Date().toISOString(),
        telegram_last_error: err,
      })
      .eq("id", data.subjectId);

    await audit(supabase, {
      subject_kind: data.kind,
      subject_id: data.subjectId,
      action: "test_message",
      chat_id: chatId,
      success: ok,
      error: err,
      actor_id: userId,
    });

    return ok ? { ok: true as const } : { ok: false as const, error: err ?? "Yuborilmadi" };
  });
