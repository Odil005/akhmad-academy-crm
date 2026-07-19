import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Staff-only: register the Telegram webhook using the env bot token. */
export const setTelegramWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ url: z.string().url() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (rolesData ?? []).map((r) => r.role as string);
    if (!roles.includes("director") && !roles.includes("admin")) {
      throw new Response("Forbidden", { status: 403 });
    }
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Response("TELEGRAM_BOT_TOKEN sozlanmagan", { status: 400 });
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret) throw new Response("TELEGRAM_WEBHOOK_SECRET sozlanmagan", { status: 400 });

    const resp = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: data.url,
        secret_token: secret,
        allowed_updates: ["message", "edited_message", "callback_query"],
      }),
    });
    const body = (await resp.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: unknown };
    if (!body.ok) throw new Response(body.description ?? `HTTP ${resp.status}`, { status: 502 });

    // Fetch bot info for the parent-link URL.
    const meResp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const me = (await meResp.json().catch(() => ({}))) as { ok?: boolean; result?: { username?: string } };
    return { ok: true, username: me.result?.username ?? null };
  });

/** Staff-only: return the bot username (for building t.me links). */
export const getTelegramBotInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (rolesData ?? []).map((r) => r.role as string);
    if (!roles.includes("director") && !roles.includes("admin") && !roles.includes("teacher")) {
      throw new Response("Forbidden", { status: 403 });
    }
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return { configured: false as const };
    const meResp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const me = (await meResp.json().catch(() => ({}))) as { ok?: boolean; result?: { username?: string } };
    return { configured: true as const, username: me.result?.username ?? null };
  });

/**
 * Staff-only: mint a single-use, short-lived Telegram link token for a
 * student. Returns the token and the deep link the parent should open.
 * The webhook validates and consumes this token — raw student IDs are not
 * accepted, so a leaked student ID can no longer hijack notifications.
 */
export const createParentLinkToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      studentId: z.string().uuid(),
      ttlMinutes: z.number().int().min(5).max(60 * 24 * 7).optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (rolesData ?? []).map((r) => r.role as string);
    if (!roles.includes("director") && !roles.includes("admin") && !roles.includes("teacher")) {
      throw new Response("Forbidden", { status: 403 });
    }

    // 32 random bytes → base64url (~43 chars), unguessable.
    const buf = new Uint8Array(32);
    crypto.getRandomValues(buf);
    const token = btoa(String.fromCharCode(...buf))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const ttl = (data.ttlMinutes ?? 60) * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttl).toISOString();

    const { error } = await supabase.from("parent_link_tokens").insert({
      token,
      student_id: data.studentId,
      created_by: userId,
      expires_at: expiresAt,
    });
    if (error) throw new Response(error.message, { status: 400 });

    // Try to include the bot username for a ready-to-share link.
    let username: string | null = null;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken) {
      try {
        const meResp = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const me = (await meResp.json().catch(() => ({}))) as { result?: { username?: string } };
        username = me.result?.username ?? null;
      } catch { /* ignore */ }
    }

    return {
      token,
      expires_at: expiresAt,
      username,
      link: username ? `https://t.me/${username}?start=${token}` : null,
    };
  });
