import { createFileRoute } from "@tanstack/react-router";

// Daily director report — called by pg_cron at 21:00 Asia/Tashkent (16:00 UTC).
// Auth: Supabase anon key in `apikey` header (public /api/public/* endpoint).

const TG_API = "https://api.telegram.org";

async function sendTelegram(botToken: string, chatId: string, text: string) {
  try {
    const r = await fetch(`${TG_API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; result?: { message_id?: number }; description?: string };
    return { ok: !!j.ok, message_id: j.result?.message_id, error: j.description };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function jarvisSummarize(payload: Record<string, unknown>): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return "";
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Sen Akhmad Academy o'quv markazining biznes-sherigisan. O'zbek tilida qisqacha, aniq va professional yakuniy hisobot yozasan. 3-5 gap, muhim raqamlar va tavsiyalar bilan.",
          },
          { role: "user", content: `Bugungi hisobot ma'lumotlari:\n${JSON.stringify(payload, null, 2)}\n\nQisqa xulosa va tavsiya yoz.` },
        ],
        temperature: 0.6,
      }),
    });
    const j = (await r.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content ?? "";
  } catch {
    return "";
  }
}

async function buildAndSend() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const startISO = `${today}T00:00:00Z`;
  const endISO = `${today}T23:59:59Z`;

  // Revenue = paid income today
  const { data: incomeTx } = await supabaseAdmin
    .from("transactions")
    .select("amount, category")
    .eq("type", "income")
    .gte("occurred_at", startISO)
    .lte("occurred_at", endISO);
  const revenue = (incomeTx ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);

  const { data: expenseTx } = await supabaseAdmin
    .from("transactions")
    .select("amount")
    .eq("type", "expense")
    .gte("occurred_at", startISO)
    .lte("occurred_at", endISO);
  const expenses = (expenseTx ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);

  // Debtors
  const { data: pendingPays } = await supabaseAdmin
    .from("payments")
    .select("amount, student_id")
    .eq("status", "pending");
  const debtorsAmount = (pendingPays ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const debtorsCount = new Set((pendingPays ?? []).map((r) => r.student_id)).size;

  // New leads today
  const { count: newLeads } = await supabaseAdmin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startISO)
    .lte("created_at", endISO);

  // New students today
  const { count: newStudents } = await supabaseAdmin
    .from("students")
    .select("id", { count: "exact", head: true })
    .gte("enrolled_at", startISO)
    .lte("enrolled_at", endISO);

  // Attendance
  const { data: att } = await supabaseAdmin
    .from("attendance")
    .select("status")
    .eq("date", today);
  const total = att?.length ?? 0;
  const present = (att ?? []).filter((r) => r.status === "present" || r.status === "late").length;
  const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

  const payload = {
    date: today,
    revenue,
    expenses,
    profit: revenue - expenses,
    new_leads: newLeads ?? 0,
    new_students: newStudents ?? 0,
    attendance_rate: attendanceRate,
    debtors_count: debtorsCount,
    debtors_amount: debtorsAmount,
  };

  const aiSummary = await jarvisSummarize(payload);

  // Store report
  const { data: report } = await supabaseAdmin
    .from("director_daily_reports")
    .upsert(
      {
        report_date: today,
        revenue,
        expenses,
        profit: revenue - expenses,
        new_leads: newLeads ?? 0,
        new_students: newStudents ?? 0,
        attendance_rate: attendanceRate,
        debtors_count: debtorsCount,
        debtors_amount: debtorsAmount,
        top_teachers: [],
        ai_summary: aiSummary,
        payload,
      },
      { onConflict: "report_date" },
    )
    .select()
    .maybeSingle();

  // Send to all active recipients
  const { data: recipients } = await supabaseAdmin
    .from("director_report_recipients")
    .select("telegram_chat_id, full_name")
    .eq("is_active", true);

  const fmt = (n: number) => Number(n).toLocaleString("uz-UZ");
  const text = [
    `📊 <b>Akhmad Academy — Kunlik hisobot</b>`,
    `📅 ${new Date(today).toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" })}`,
    ``,
    `💰 <b>Daromad:</b> ${fmt(revenue)} so'm`,
    `💸 <b>Xarajat:</b> ${fmt(expenses)} so'm`,
    `📈 <b>Sof foyda:</b> ${fmt(revenue - expenses)} so'm`,
    ``,
    `👥 Yangi lidlar: <b>${newLeads ?? 0}</b>`,
    `🎓 Yangi o'quvchilar: <b>${newStudents ?? 0}</b>`,
    `✅ Davomat: <b>${attendanceRate}%</b>`,
    `🔴 Qarzdorlar: <b>${debtorsCount}</b> ta (${fmt(debtorsAmount)} so'm)`,
    ``,
    aiSummary ? `🤖 <b>Jarvis xulosasi:</b>\n${aiSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const sends: Array<{ chat_id: string; ok: boolean; error?: string }> = [];
  if (botToken) {
    for (const r of recipients ?? []) {
      const res = await sendTelegram(botToken, r.telegram_chat_id, text);
      sends.push({ chat_id: r.telegram_chat_id, ok: res.ok, error: res.error });
    }
  }

  if (report?.id) {
    await supabaseAdmin
      .from("director_daily_reports")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", report.id);
  }

  return { ok: true, report_id: report?.id, sends };
}

export const Route = createFileRoute("/api/public/cron/daily-report")({
  server: {
    handlers: {
      GET: async () => Response.json(await buildAndSend()),
      POST: async () => Response.json(await buildAndSend()),
    },
  },
});
