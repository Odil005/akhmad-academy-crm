import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import {
  isValidTelegramWebhookSecret,
  normalizeTelegramAppBaseUrl,
} from "@/features/telegram/domain";

type AppSupabase = SupabaseClient<Database>;

async function rolesOf(supabase: AppSupabase, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((row) => row.role as string);
}

function randomLinkToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Admin/director: register the production webhook and the public bot commands. */
export const setTelegramWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const roles = await rolesOf(supabase, userId);
    if (!roles.includes("director") && !roles.includes("admin")) {
      throw new Response("Forbidden", { status: 403 });
    }

    const requestOrigin = await (async () => {
      try {
        const { getRequestUrl } = await import("@tanstack/react-start/server");
        return normalizeTelegramAppBaseUrl(new URL(getRequestUrl()).origin);
      } catch {
        return null;
      }
    })();

    const baseUrl =
      normalizeTelegramAppBaseUrl(process.env.APP_BASE_URL ?? "") ?? requestOrigin;
    if (!baseUrl) {
      throw new Response("Publik HTTPS domen aniqlanmadi. APP_BASE_URL ni sozlang", {
        status: 400,
      });
    }
    const explicitSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
    const sanitized = explicitSecret.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 256);
    const { deriveTelegramWebhookSecret } = await import("@/lib/telegram.server");
    const secret = isValidTelegramWebhookSecret(explicitSecret)
      ? explicitSecret
      : isValidTelegramWebhookSecret(sanitized)
        ? sanitized
        : deriveTelegramWebhookSecret();
    if (!secret) {
      throw new Response("TELEGRAM_BOT_TOKEN sozlanmagan", { status: 400 });
    }


    const { callTelegram } = await import("@/lib/telegram.server");
    const webhookUrl = `${baseUrl}/api/public/telegram/webhook`;
    const webhook = await callTelegram<boolean>("setWebhook", {
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      max_connections: 20,
      drop_pending_updates: false,
    });
    if (!webhook.ok) throw new Response(webhook.error, { status: 502 });

    const commands = await callTelegram<boolean>("setMyCommands", {
      commands: [
        { command: "start", description: "Botni ishga tushirish va ulanish" },
        { command: "menu", description: "Bosh menyuni ochish" },
        { command: "today", description: "Bugungi ma'lumotlar" },
        { command: "messages", description: "Xabarlarni ko'rish" },
        { command: "attendance", description: "Davomat holatini ko'rish" },
        { command: "report", description: "Markaz hisobotini ko'rish" },
        { command: "status", description: "Ulanish holatini tekshirish" },
        { command: "help", description: "Yordam" },
      ],
    });
    if (!commands.ok) {
      throw new Response(`Webhook o'rnatildi, lekin buyruqlar saqlanmadi: ${commands.error}`, {
        status: 502,
      });
    }

    await Promise.all([
      callTelegram("setMyDescription", {
        description:
          "Akhmad Academy CRM boti: davomat, to'lov, dars jadvali va o'qituvchi bilan aloqa.",
      }),
      callTelegram("setMyShortDescription", {
        short_description: "Akhmad Academy o'quv markazi yordamchisi",
      }),
    ]);

    const me = await callTelegram<{ username?: string }>("getMe", {});
    return {
      ok: true,
      username: me.ok ? (me.result.username ?? null) : null,
      webhookUrl,
    };
  });

/** Staff: return bot identity and webhook health without exposing the token. */
export const getTelegramBotInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const roles = await rolesOf(supabase, userId);
    if (!roles.some((role) => role === "director" || role === "admin" || role === "teacher")) {
      throw new Response("Forbidden", { status: 403 });
    }
    if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) return { configured: false as const };

    const { callTelegram } = await import("@/lib/telegram.server");
    const [me, webhook] = await Promise.all([
      callTelegram<{ username?: string; first_name?: string }>("getMe", {}),
      callTelegram<{
        url?: string;
        pending_update_count?: number;
        last_error_date?: number;
        last_error_message?: string;
      }>("getWebhookInfo", {}),
    ]);
    if (!me.ok) {
      return {
        configured: true as const,
        healthy: false as const,
        username: null,
        error: me.error,
      };
    }

    const expectedBase = normalizeTelegramAppBaseUrl(process.env.APP_BASE_URL ?? "");
    const expectedUrl = expectedBase ? `${expectedBase}/api/public/telegram/webhook` : null;
    const webhookInfo = webhook.ok ? webhook.result : null;
    return {
      configured: true as const,
      healthy: webhook.ok && Boolean(webhookInfo?.url) && webhookInfo?.url === expectedUrl,
      username: me.result.username ?? null,
      name: me.result.first_name ?? null,
      webhook: {
        url: webhookInfo?.url ?? null,
        expectedUrl,
        pending: webhookInfo?.pending_update_count ?? 0,
        lastError: webhookInfo?.last_error_message ?? (webhook.ok ? null : webhook.error),
        lastErrorAt: webhookInfo?.last_error_date
          ? new Date(webhookInfo.last_error_date * 1000).toISOString()
          : null,
      },
    };
  });

/** Staff: mint a one-use link for a student's parent. */
export const createParentLinkToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        studentId: z.string().uuid(),
        ttlMinutes: z
          .number()
          .int()
          .min(5)
          .max(60 * 24 * 7)
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesOf(supabase, userId);
    const isManager = roles.includes("director") || roles.includes("admin");
    const isTeacher = roles.includes("teacher");
    if (!isManager && !isTeacher) throw new Response("Forbidden", { status: 403 });

    if (!isManager) {
      const { data: enrollment } = await supabase
        .from("student_enrollments")
        .select("id")
        .eq("student_id", data.studentId)
        .eq("teacher_user_id", userId)
        .in("status", ["active", "trial"])
        .limit(1)
        .maybeSingle();
      if (!enrollment) throw new Response("Bu o'quvchi sizning guruhingizda emas", { status: 403 });
    }

    const token = randomLinkToken();
    const { hashTelegramLinkToken, callTelegram } = await import("@/lib/telegram.server");
    const storedToken = await hashTelegramLinkToken(token);
    const expiresAt = new Date(Date.now() + (data.ttlMinutes ?? 60) * 60 * 1000).toISOString();

    const { error } = await supabase.from("parent_link_tokens").insert({
      token: storedToken,
      student_id: data.studentId,
      created_by: userId,
      expires_at: expiresAt,
    });
    if (error) throw new Response(error.message, { status: 400 });

    const me = await callTelegram<{ username?: string }>("getMe", {});
    const username = me.ok ? (me.result.username ?? null) : null;
    return {
      token,
      expires_at: expiresAt,
      username,
      link: username ? `https://t.me/${username}?start=${token}` : null,
    };
  });

/** Staff: mint a one-use Telegram link for a student, teacher, admin or director. */
export const createTelegramLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        kind: z.enum(["student", "teacher", "admin", "director"]),
        studentId: z.string().uuid().optional().nullable(),
        targetUserId: z.string().uuid().optional().nullable(),
        label: z.string().max(200).optional().nullable(),
        ttlMinutes: z
          .number()
          .int()
          .min(5)
          .max(60 * 24 * 7)
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesOf(supabase, userId);
    const isDirector = roles.includes("director");
    const isAdmin = roles.includes("admin");
    const isTeacher = roles.includes("teacher");
    if (!isDirector && !isAdmin && !isTeacher) return { ok: false as const, error: "Ruxsat yo'q" };
    if (data.kind === "student" && !data.studentId)
      return { ok: false as const, error: "O'quvchi tanlanmagan" };
    if (data.kind !== "student" && !data.targetUserId)
      return { ok: false as const, error: "Foydalanuvchi tanlanmagan" };

    if (!isDirector && data.kind === "director") {
      return { ok: false as const, error: "Direktor Telegramini faqat direktor ulaydi" };
    }
    if (!isDirector && data.kind === "admin" && (!isAdmin || data.targetUserId !== userId)) {
      return { ok: false as const, error: "Admin faqat o'z Telegramini ulay oladi" };
    }
    if (!isDirector && !isAdmin && data.kind === "teacher" && data.targetUserId !== userId) {
      return { ok: false as const, error: "Faqat o'zingizning Telegram ID'ingizni yarata olasiz" };
    }
    if (!isDirector && !isAdmin && data.kind === "student") {
      const { data: enrollment } = await supabase
        .from("student_enrollments")
        .select("id")
        .eq("student_id", data.studentId!)
        .eq("teacher_user_id", userId)
        .in("status", ["active", "trial"])
        .limit(1)
        .maybeSingle();
      if (!enrollment)
        return { ok: false as const, error: "Bu o'quvchi sizning guruhingizga biriktirilmagan" };
    }
    if (data.kind !== "student") {
      const { data: targetRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.targetUserId!);
      if (!(targetRoles ?? []).some((row) => row.role === data.kind)) {
        return { ok: false as const, error: "Tanlangan foydalanuvchining roli mos emas" };
      }
    }

    const token = randomLinkToken();
    const { hashTelegramLinkToken, callTelegram } = await import("@/lib/telegram.server");
    const storedToken = await hashTelegramLinkToken(token);
    const expiresAt = new Date(Date.now() + (data.ttlMinutes ?? 60 * 24) * 60 * 1000).toISOString();
    const { error } = await supabase.from("telegram_link_tokens").insert({
      token: storedToken,
      kind: data.kind,
      student_id: data.kind === "student" ? data.studentId! : null,
      user_id: data.kind === "student" ? null : data.targetUserId!,
      label: data.label ?? null,
      created_by: userId,
      expires_at: expiresAt,
    });
    if (error) return { ok: false as const, error: error.message };

    const me = await callTelegram<{ username?: string }>("getMe", {});
    const username = me.ok ? (me.result.username ?? null) : null;
    return {
      ok: true as const,
      token,
      expires_at: expiresAt,
      username,
      link: username ? `https://t.me/${username}?start=${token}` : null,
    };
  });
