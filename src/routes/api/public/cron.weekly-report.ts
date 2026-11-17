import { createFileRoute } from "@tanstack/react-router";
import { isCronRequestAuthorized, unauthorizedCronResponse } from "@/lib/cron-auth.server";

// Weekly director report — called by pg_cron on Monday 21:00 Asia/Tashkent (16:00 UTC).
// Covers the calendar week that just ended (Monday..Sunday).
// Auth: shared cron secret in the `x-cron-secret` header (public /api/public/* endpoint).

const TG_API = "https://api.telegram.org";

async function sendTelegram(botToken: string, chatId: string, text: string) {
  try {
    const r = await fetch(`${TG_API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const j = (await r.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    };
    return { ok: !!j.ok, message_id: j.result?.message_id, error: j.description };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function jarvisSummarize(payload: Record<string, unknown>): Promise<string> {
  const { aiQuickText } = await import("@/lib/jarvis-ai.server");
  return aiQuickText(
    "Sen Akhmad Academy o'quv markazining biznes-sherigisan. O'zbek tilida qisqacha, aniq va professional haftalik hisobot yozasan. 3-5 gap, muhim raqamlar va keyingi hafta uchun tavsiyalar bilan.",
    `Haftalik hisobot ma'lumotlari:\n${JSON.stringify(payload, null, 2)}\n\nQisqa xulosa va tavsiya yoz.`,
    { timeoutMs: 20_000 },
  );
}

// Telegram HTML mode: escape markup, then turn the AI's **bold** into <b>.
function aiSummaryHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

// Previous calendar week: Monday..Sunday, computed in Tashkent time (UTC+5).
function previousWeek(now: Date) {
  const tz = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const iso = tz.toISOString().slice(0, 10);
  const today = new Date(`${iso}T00:00:00Z`);
  const weekday = (today.getUTCDay() + 6) % 7; // 0 = Monday
  const thisMonday = new Date(today);
  thisMonday.setUTCDate(today.getUTCDate() - weekday);
  const start = new Date(thisMonday);
  start.setUTCDate(thisMonday.getUTCDate() - 7);
  const end = new Date(thisMonday);
  end.setUTCDate(thisMonday.getUTCDate() - 1);
  return {
    startISO: start.toISOString().slice(0, 10),
    endISO: end.toISOString().slice(0, 10),
    startFull: `${start.toISOString().slice(0, 10)}T00:00:00Z`,
    endFull: `${end.toISOString().slice(0, 10)}T23:59:59Z`,
  };
}

async function resolveChatIds(supabaseAdmin: any): Promise<Set<string>> {
  const chatIds = new Set<string>();

  const { data: recipients } = await supabaseAdmin
    .from("director_report_recipients")
    .select("telegram_chat_id")
    .eq("is_active", true);
  for (const r of recipients ?? []) {
    const id = (r.telegram_chat_id ?? "").trim();
    if (id) chatIds.add(id);
  }
  if (chatIds.size > 0) return chatIds;

  const { data: staffLinks } = await supabaseAdmin
    .from("staff_telegram_links")
    .select("telegram_chat_id, role, notifications_enabled")
    .in("role", ["director", "admin"]);
  for (const link of staffLinks ?? []) {
    if (link.notifications_enabled === false) continue;
    const id = (link.telegram_chat_id ?? "").trim();
    if (id) chatIds.add(id);
  }
  if (chatIds.size > 0) return chatIds;

  const { data: roleRows } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .in("role", ["director", "admin"]);
  const ids = (roleRows ?? []).map((r: { user_id: string }) => r.user_id);
  if (ids.length > 0) {
    const { data: staffProfiles } = await supabaseAdmin
      .from("profiles")
      .select("telegram_chat_id")
      .in("id", ids)
      .not("telegram_chat_id", "is", null);
    for (const p of staffProfiles ?? []) {
      const id = (p.telegram_chat_id ?? "").trim();
      if (id) chatIds.add(id);
    }
  }
  return chatIds;
}

async function buildAndSend() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  const { startISO, endISO, startFull, endFull } = previousWeek(new Date());

  const { data: incomeTx } = await supabaseAdmin
    .from("transactions")
    .select("amount")
    .eq("type", "income")
    .gte("occurred_at", startFull)
    .lte("occurred_at", endFull);
  const revenue = (incomeTx ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);

  const { data: expenseTx } = await supabaseAdmin
    .from("transactions")
    .select("amount")
    .eq("type", "expense")
    .gte("occurred_at", startFull)
    .lte("occurred_at", endFull);
  const expenses = (expenseTx ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);

  const { data: pendingPays } = await supabaseAdmin
    .from("payments")
    .select("amount, student_id")
    .eq("status", "pending");
  const debtorsAmount = (pendingPays ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const debtorsCount = new Set((pendingPays ?? []).map((r) => r.student_id)).size;

  const { count: newLeads } = await supabaseAdmin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startFull)
    .lte("created_at", endFull);

  const { count: newStudents } = await supabaseAdmin
    .from("students")
    .select("id", { count: "exact", head: true })
    .gte("enrolled_at", startFull)
    .lte("enrolled_at", endFull);

  const { data: att } = await supabaseAdmin
    .from("attendance")
    .select("status")
    .gte("date", startISO)
    .lte("date", endISO);
  const total = att?.length ?? 0;
  const present = (att ?? []).filter((r) => r.status === "present" || r.status === "late").length;
  const absent = (att ?? []).filter((r) => r.status === "absent").length;
  const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

  const payload = {
    week_start: startISO,
    week_end: endISO,
    revenue,
    expenses,
    profit: revenue - expenses,
    new_leads: newLeads ?? 0,
    new_students: newStudents ?? 0,
    attendance_marks: total,
    attendance_rate: attendanceRate,
    absent_marks: absent,
    debtors_count: debtorsCount,
    debtors_amount: debtorsAmount,
  };

  const aiSummary = await jarvisSummarize(payload);

  const fmt = (n: number) => Number(n).toLocaleString("uz-UZ");
  const text = [
    `📊 <b>Akhmad Academy — Haftalik hisobot</b>`,
    `📅 ${startISO} — ${endISO}`,
    ``,
    `💰 <b>Daromad:</b> ${fmt(revenue)} so'm`,
    `💸 <b>Xarajat:</b> ${fmt(expenses)} so'm`,
    `📈 <b>Sof foyda:</b> ${fmt(revenue - expenses)} so'm`,
    ``,
    `👥 Yangi lidlar: <b>${newLeads ?? 0}</b>`,
    `🎓 Yangi o'quvchilar: <b>${newStudents ?? 0}</b>`,
    `✅ Davomat: <b>${attendanceRate}%</b> (${total} ta belgi, ${absent} ta kelmadi)`,
    `🔴 Qarzdorlar: <b>${debtorsCount}</b> ta (${fmt(debtorsAmount)} so'm)`,
    ``,
    aiSummary ? `🤖 <b>Jarvis xulosasi:</b>\n${aiSummaryHtml(aiSummary)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const chatIds = await resolveChatIds(supabaseAdmin);

  const sends: Array<{ chat_id: string; ok: boolean; error?: string }> = [];
  if (botToken) {
    for (const chatId of chatIds) {
      const res = await sendTelegram(botToken, chatId, text);
      sends.push({ chat_id: chatId, ok: res.ok, error: res.error });
    }
  }

  return { ok: true, week_start: startISO, week_end: endISO, recipients: chatIds.size, sends };
}

export const Route = createFileRoute("/api/public/cron/weekly-report")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        (await isCronRequestAuthorized(request))
          ? Response.json(await buildAndSend())
          : unauthorizedCronResponse(),
      POST: async ({ request }) =>
        (await isCronRequestAuthorized(request))
          ? Response.json(await buildAndSend())
          : unauthorizedCronResponse(),
    },
  },
});
