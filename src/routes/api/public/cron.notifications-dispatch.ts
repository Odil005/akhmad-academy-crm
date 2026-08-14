import { createFileRoute } from "@tanstack/react-router";
import { isCronRequestAuthorized, unauthorizedCronResponse } from "@/lib/cron-auth.server";

// Dispatch pending parent_notifications to Telegram. Runs every 5 minutes.

const TG = "https://api.telegram.org";

async function send(botToken: string, chatId: string, text: string) {
  try {
    const r = await fetch(`${TG}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    return { ok: !!j.ok, error: j.description };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const fmt = (n: number) => Number(n).toLocaleString("uz-UZ");

function renderMessage(
  kind: string,
  payload: Record<string, unknown>,
  studentName: string,
): string {
  const p = payload as Record<string, string | number | undefined>;
  switch (kind) {
    case "payment_paid":
      return `✅ To'lov qabul qilindi\n👤 ${studentName}\n💰 ${fmt(Number(p.amount || 0))} so'm\n📅 Davr: ${p.period_month}`;
    case "payment_due":
      return `💳 To'lov muddati\n👤 ${studentName}\n💰 ${fmt(Number(p.amount || 0))} so'm\n⏰ ${p.next_due_date ?? "muddati kelmoqda"}`;
    case "attendance": {
      const s = String(p.status);
      const label = s === "absent" ? "❌ Kelmadi" : s === "late" ? "⏱ Kech qoldi" : s;
      return `${label}\n👤 ${studentName}\n📅 ${p.date}`;
    }
    case "behavior": {
      const rating = Number(p.rating || 0);
      const activity =
        rating >= 4
          ? "Faol"
          : rating >= 3
            ? "Yaxshi"
            : rating > 0
              ? "E'tibor kerak"
              : "Qayd etildi";
      return [
        `📚 Darsdagi faollik — ${activity}`,
        `👤 ${studentName}`,
        p.lesson_date ? `📅 ${p.lesson_date}` : null,
        p.comment ? `💬 ${p.comment}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "daily_digest": {
      const pd = payload as {
        attendance?: string[];
        debt?: number;
        pending_count?: number;
        ref_date?: string;
      };
      const attLine = pd.attendance?.length ? pd.attendance.join(", ") : "yozuv yo'q";
      const debtLine = pd.debt ? `${fmt(pd.debt)} so'm (${pd.pending_count} ta)` : "qarz yo'q ✅";
      return [
        `🌙 Kunlik hisobot — ${pd.ref_date}`,
        `👤 ${studentName}`,
        `📚 Bugungi darslar: ${attLine}`,
        `💰 Qarz: ${debtLine}`,
      ].join("\n");
    }
    default:
      return `ℹ️ ${studentName}`;
  }
}

async function dispatch() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false, error: "TELEGRAM_BOT_TOKEN not configured" };

  // A previous function invocation may have stopped after claiming a row.
  await supabaseAdmin
    .from("parent_notifications")
    .update({ status: "pending", processing_started_at: null })
    .eq("status", "processing")
    .lt("processing_started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

  const { data: pending } = await supabaseAdmin
    .from("parent_notifications")
    .select("id, student_id, kind, payload, attempts")
    .eq("status", "pending")
    .eq("channel", "telegram")
    .order("created_at")
    .limit(100);

  let sent = 0;
  let failed = 0;
  for (const n of pending ?? []) {
    const { data: claimed } = await supabaseAdmin
      .from("parent_notifications")
      .update({
        status: "processing",
        processing_started_at: new Date().toISOString(),
        attempts: n.attempts + 1,
      })
      .eq("id", n.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const { data: s } = await supabaseAdmin
      .from("students")
      .select("first_name, last_name, parent_telegram_chat_id, parent_notifications_enabled")
      .eq("id", n.student_id)
      .maybeSingle();
    if (!s || !s.parent_telegram_chat_id || !s.parent_notifications_enabled) {
      await supabaseAdmin
        .from("parent_notifications")
        .update({
          status: "skipped",
          error: "no chat_id or disabled",
          sent_at: new Date().toISOString(),
          processing_started_at: null,
        })
        .eq("id", n.id);
      continue;
    }
    const name = `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "O'quvchi";
    const text = renderMessage(n.kind, (n.payload as Record<string, unknown>) ?? {}, name);
    const res = await send(botToken, s.parent_telegram_chat_id, text);
    const nextAttempt = n.attempts + 1;
    await supabaseAdmin
      .from("parent_notifications")
      .update({
        status: res.ok ? "sent" : nextAttempt < 5 ? "pending" : "failed",
        error: res.error ?? null,
        sent_at: res.ok ? new Date().toISOString() : null,
        processing_started_at: null,
      })
      .eq("id", n.id);
    if (res.ok) sent += 1;
    else failed += 1;
  }

  return { ok: true, sent, failed, total: pending?.length ?? 0 };
}

export const Route = createFileRoute("/api/public/cron/notifications-dispatch")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        isCronRequestAuthorized(request)
          ? Response.json(await dispatch())
          : unauthorizedCronResponse(),
      POST: async ({ request }) =>
        isCronRequestAuthorized(request)
          ? Response.json(await dispatch())
          : unauthorizedCronResponse(),
    },
  },
});
