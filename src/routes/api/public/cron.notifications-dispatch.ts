import { createFileRoute } from "@tanstack/react-router";

// Dispatch pending parent_notifications to Telegram. Runs every 5 minutes.

const TG = "https://api.telegram.org";

async function send(botToken: string, chatId: string, text: string) {
  try {
    const r = await fetch(`${TG}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    return { ok: !!j.ok, error: j.description };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const fmt = (n: number) => Number(n).toLocaleString("uz-UZ");

function renderMessage(kind: string, payload: Record<string, unknown>, studentName: string): string {
  const p = payload as Record<string, string | number | undefined>;
  switch (kind) {
    case "payment_paid":
      return `✅ <b>To'lov qabul qilindi</b>\n👤 ${studentName}\n💰 ${fmt(Number(p.amount || 0))} so'm\n📅 Davr: ${p.period_month}`;
    case "payment_due":
      return `💳 <b>To'lov muddati</b>\n👤 ${studentName}\n💰 ${fmt(Number(p.amount || 0))} so'm\n⏰ ${p.next_due_date ?? "muddati kelmoqda"}`;
    case "grade":
      return `📝 <b>Yangi baho</b>\n👤 ${studentName}\n⭐ ${p.score}/${p.max_score} (${p.kind})`;
    case "behavior":
      return `😊 <b>Xulq bahosi</b>\n👤 ${studentName}\n📊 ${p.rating}${p.comment ? `\n💬 ${p.comment}` : ""}`;
    case "attendance": {
      const s = String(p.status);
      const label = s === "absent" ? "❌ Kelmadi" : s === "late" ? "⏱ Kech qoldi" : s;
      return `${label}\n👤 ${studentName}\n📅 ${p.date}`;
    }
    case "daily_digest": {
      const pd = payload as { attendance?: string[]; grades?: { score: number; max_score: number }[]; debt?: number; pending_count?: number; ref_date?: string };
      const attLine = pd.attendance?.length ? pd.attendance.join(", ") : "yozuv yo'q";
      const gradesLine = pd.grades?.length ? pd.grades.map((g) => `${g.score}/${g.max_score}`).join(", ") : "yo'q";
      const debtLine = pd.debt ? `${fmt(pd.debt)} so'm (${pd.pending_count} ta)` : "qarz yo'q ✅";
      return [
        `🌙 <b>Kunlik hisobot</b> — ${pd.ref_date}`,
        `👤 ${studentName}`,
        `📚 Bugungi darslar: ${attLine}`,
        `📝 Baholar: ${gradesLine}`,
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

  const { data: pending } = await supabaseAdmin
    .from("parent_notifications")
    .select("id, student_id, kind, payload")
    .eq("status", "pending")
    .eq("channel", "telegram")
    .order("created_at")
    .limit(100);

  let sent = 0;
  let failed = 0;
  for (const n of pending ?? []) {
    const { data: s } = await supabaseAdmin
      .from("students")
      .select("first_name, last_name, parent_telegram_chat_id, parent_notifications_enabled")
      .eq("id", n.student_id)
      .maybeSingle();
    if (!s || !s.parent_telegram_chat_id || !s.parent_notifications_enabled) {
      await supabaseAdmin
        .from("parent_notifications")
        .update({ status: "skipped", error: "no chat_id or disabled", sent_at: new Date().toISOString() })
        .eq("id", n.id);
      continue;
    }
    const name = `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "O'quvchi";
    const text = renderMessage(n.kind, (n.payload as Record<string, unknown>) ?? {}, name);
    const res = await send(botToken, s.parent_telegram_chat_id, text);
    await supabaseAdmin
      .from("parent_notifications")
      .update({
        status: res.ok ? "sent" : "failed",
        error: res.error ?? null,
        sent_at: new Date().toISOString(),
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
      GET: async () => Response.json(await dispatch()),
      POST: async () => Response.json(await dispatch()),
    },
  },
});
