import { createFileRoute } from "@tanstack/react-router";
import { isCronRequestAuthorized, unauthorizedCronResponse } from "@/lib/cron-auth.server";
import { runSafeJarvisMaintenance } from "@/lib/jarvis-maintenance.server";
import { sendTelegramText } from "@/lib/telegram.server";

// Dispatch pending parent_notifications to Telegram. Runs every 5 minutes.

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
      const activity =
        {
          qoniqarsiz: "E'tibor kerak",
          qoniqarli: "Qatnashdi",
          yaxshi: "Faol",
          alo: "Juda faol",
        }[String(p.rating)] ?? "Qayd etildi";
      return [
        `📚 Darsdagi faollik — ${activity}`,
        `👤 ${studentName}`,
        p.lesson_date ? `📅 ${p.lesson_date}` : null,
        p.comment ? `💬 ${p.comment}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "jarvis_message":
      return [
        "🤖 O'quv markazidan xabar",
        `👤 ${studentName}`,
        p.reason ? `📌 ${p.reason}` : null,
        p.message ? `💬 ${p.message}` : null,
      ]
        .filter(Boolean)
        .join("\n");
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

  const maintenance = await runSafeJarvisMaintenance();

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
    const res = await sendTelegramText(s.parent_telegram_chat_id, text);
    const nextAttempt = n.attempts + 1;
    await supabaseAdmin
      .from("parent_notifications")
      .update({
        status: res.ok ? "sent" : nextAttempt < 5 ? "pending" : "failed",
        error: res.ok ? null : res.error,
        sent_at: res.ok ? new Date().toISOString() : null,
        processing_started_at: null,
      })
      .eq("id", n.id);
    if (res.ok) sent += 1;
    else failed += 1;
  }

  const { data: receiptRows } = await supabaseAdmin
    .from("notification_queue")
    .select("id, telegram_chat_id, message_text, attempts")
    .eq("status", "pending")
    .lt("attempts", 8)
    .not("telegram_chat_id", "is", null)
    .limit(30);
  let receiptsSent = 0;
  for (const row of receiptRows ?? []) {
    if (!row.telegram_chat_id) continue;
    const result = await sendTelegramText(row.telegram_chat_id, row.message_text);
    await supabaseAdmin
      .from("notification_queue")
      .update({
        status: result.ok ? "sent" : "pending",
        attempts: (row.attempts ?? 0) + 1,
        last_error: result.ok ? null : result.error,
        sent_at: result.ok ? new Date().toISOString() : null,
      })
      .eq("id", row.id);
    if (result.ok) receiptsSent += 1;
  }

  return {
    ok: true,
    sent,
    failed,
    total: pending?.length ?? 0,
    receiptsSent,
    maintenance,
  };
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
