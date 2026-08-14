import { createFileRoute } from "@tanstack/react-router";
import { isCronRequestAuthorized, unauthorizedCronResponse } from "@/lib/cron-auth.server";

/**
 * Daily payment reminder cron.
 * Assumption: payment.period_month is the first-of-month date; monthly due date = day 10.
 * Sends reminders at 5, 3, 1 days before due, day-of, and every 3 days after (recurring).
 * Deduplication via payment_notifications unique index (student, period, type, day).
 * Skips paid-in-full periods and sends a confirmation once when a payment flips to `paid`.
 *
 * Also handles daily lesson reminders (kept from the previous version) via parent_notifications.
 */
async function runReminders(request: Request): Promise<Response> {
  if (!isCronRequestAuthorized(request)) return unauthorizedCronResponse();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const { sendTelegramText } = await import("@/lib/telegram.server");

  const sendTelegram = async (chat_id: string, text: string) => {
    if (!token) return { ok: false, error: "Bot token sozlanmagan" };
    const result = await sendTelegramText(chat_id, text);
    return result.ok ? { ok: true, error: null } : { ok: false, error: result.error };
  };

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const results = {
    payment_sent: 0,
    payment_skipped: 0,
    payment_confirmed: 0,
    lesson_sent: 0,
    lesson_skipped: 0,
  };

  // ---------- PAYMENT REMINDERS ----------
  // Fetch unpaid payments for current & past 3 months.
  const cutoff = new Date(today.getFullYear(), today.getMonth() - 3, 1).toISOString().slice(0, 10);
  const { data: unpaid } = await supabaseAdmin
    .from("payments")
    .select("id, student_id, amount, period_month, status, paid_at")
    .gte("period_month", cutoff);

  // Confirm payments that got paid_at yesterday/today and not yet confirmed.
  const recentlyPaid = (unpaid ?? []).filter((p) => p.status === "paid" && p.paid_at);
  for (const p of recentlyPaid) {
    const paidDate = new Date(p.paid_at as string).toISOString().slice(0, 10);
    // Only confirm if payment happened within last 2 days
    if (Math.abs((new Date(paidDate).getTime() - today.getTime()) / 86400000) > 2) continue;

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, parent_telegram_chat_id, parent_notifications_enabled")
      .eq("id", p.student_id)
      .maybeSingle();
    if (!student?.parent_notifications_enabled || !student.parent_telegram_chat_id) continue;

    // Dedup — one confirmation per student/period/day
    const { data: exists } = await supabaseAdmin
      .from("payment_notifications")
      .select("id")
      .eq("student_id", p.student_id)
      .eq("period_month", p.period_month)
      .eq("notification_type", "paid_confirm")
      .limit(1);
    if (exists && exists.length) continue;

    const text = `✅ To'lov qabul qilindi\n${student.first_name} ${student.last_name ?? ""}\nSumma: ${Number(p.amount).toLocaleString()} so'm\nOy: ${String(p.period_month).slice(0, 7)}\n\nRahmat!`;
    const r = await sendTelegram(student.parent_telegram_chat_id, text);
    await supabaseAdmin.from("payment_notifications").insert({
      student_id: p.student_id,
      period_month: p.period_month,
      notification_type: "paid_confirm",
      parent_chat_id: student.parent_telegram_chat_id,
      status: r.ok ? "sent" : "error",
      error: r.error,
      payload: { text },
    });
    if (r.ok) results.payment_confirmed++;
  }

  // Group unpaid by student
  const debtByStudent = new Map<
    string,
    {
      total: number;
      items: { period_month: string; amount: number }[];
    }
  >();
  for (const p of unpaid ?? []) {
    if (p.status === "paid") continue;
    const cur = debtByStudent.get(p.student_id) ?? { total: 0, items: [] };
    cur.total += Number(p.amount) || 0;
    cur.items.push({ period_month: p.period_month as unknown as string, amount: Number(p.amount) });
    debtByStudent.set(p.student_id, cur);
  }

  if (debtByStudent.size) {
    const studentIds = Array.from(debtByStudent.keys());
    const { data: students } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, parent_telegram_chat_id, parent_notifications_enabled")
      .in("id", studentIds);

    for (const s of students ?? []) {
      const debt = debtByStudent.get(s.id);
      if (!debt) continue;
      // Compute the "most urgent" unpaid item — the one whose due date is closest to today.
      let bestItem: { period_month: string; amount: number } | null = null;
      let bestType:
        "remind_5" | "remind_3" | "remind_1" | "overdue_0" | "overdue_recurring" | null = null;
      let bestDue = todayISO;

      for (const it of debt.items) {
        const [y, m] = it.period_month.split("-").map(Number);
        const due = new Date(Date.UTC(y, m - 1, 10));
        const diffDays = Math.floor(
          (due.getTime() -
            Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) /
            86400000,
        );
        let type: "remind_5" | "remind_3" | "remind_1" | "overdue_0" | "overdue_recurring" | null =
          null;
        if (diffDays === 5) type = "remind_5";
        else if (diffDays === 3) type = "remind_3";
        else if (diffDays === 1) type = "remind_1";
        else if (diffDays === 0) type = "overdue_0";
        else if (diffDays < 0 && Math.abs(diffDays) % 3 === 0) type = "overdue_recurring";
        if (
          type &&
          (!bestType ||
            Math.abs(diffDays) <
              Math.abs(
                (new Date(bestDue).getTime() -
                  Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) /
                  86400000,
              ))
        ) {
          bestType = type;
          bestItem = it;
          bestDue = due.toISOString().slice(0, 10);
        }
      }
      if (!bestType || !bestItem) {
        results.payment_skipped++;
        continue;
      }

      // Dedup check
      const { data: exists } = await supabaseAdmin
        .from("payment_notifications")
        .select("id")
        .eq("student_id", s.id)
        .eq("period_month", bestItem.period_month)
        .eq("notification_type", bestType)
        .gte("sent_at", `${todayISO}T00:00:00Z`)
        .limit(1);
      if (exists && exists.length) {
        results.payment_skipped++;
        continue;
      }

      const monthStr = bestItem.period_month.slice(0, 7);
      const templates: Record<string, string> = {
        remind_5: `⏰ To'lov eslatmasi\n${s.first_name} ${s.last_name ?? ""}\n${monthStr} oyi uchun ${Number(bestItem.amount).toLocaleString()} so'm — muddat 5 kundan keyin (${bestDue}).`,
        remind_3: `⏰ To'lov eslatmasi (3 kun qoldi)\n${s.first_name} ${s.last_name ?? ""}\n${monthStr}: ${Number(bestItem.amount).toLocaleString()} so'm\nMuddat: ${bestDue}.`,
        remind_1: `⚠️ Ertaga to'lov muddati\n${s.first_name} ${s.last_name ?? ""}\n${monthStr}: ${Number(bestItem.amount).toLocaleString()} so'm\nMuddat: ${bestDue}.`,
        overdue_0: `🔴 Bugun to'lov muddati\n${s.first_name} ${s.last_name ?? ""}\n${monthStr}: ${Number(bestItem.amount).toLocaleString()} so'm.\nIltimos, bugun to'lang.`,
        overdue_recurring: `🚨 Qarzdorlik\n${s.first_name} ${s.last_name ?? ""}\nJami qarzdorlik: ${debt.total.toLocaleString()} so'm.\nIltimos, imkon qadar tezroq to'lang.`,
      };
      const text = templates[bestType];

      if (!s.parent_notifications_enabled || !s.parent_telegram_chat_id) {
        await supabaseAdmin.from("payment_notifications").insert({
          student_id: s.id,
          period_month: bestItem.period_month,
          notification_type: bestType,
          status: "skipped",
          error: "Chat ID yo'q",
          payload: { text },
        });
        results.payment_skipped++;
        continue;
      }
      const r = await sendTelegram(s.parent_telegram_chat_id, text);
      await supabaseAdmin.from("payment_notifications").insert({
        student_id: s.id,
        period_month: bestItem.period_month,
        notification_type: bestType,
        parent_chat_id: s.parent_telegram_chat_id,
        due_date: bestDue,
        status: r.ok ? "sent" : "error",
        error: r.error,
        payload: { text },
      });
      if (r.ok) results.payment_sent++;
      else results.payment_skipped++;
    }
  }

  // ---------- LESSON REMINDERS (unchanged behavior via parent_notifications) ----------
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tashkent",
    weekday: "short",
  }).format(today);
  const dow = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[weekday] ?? 1;
  const { data: lessons } = await supabaseAdmin
    .from("lessons")
    .select("id, group_id, start_time, end_time, subject_id")
    .eq("is_active", true)
    .eq("day_of_week", dow);
  const groupIds = Array.from(new Set((lessons ?? []).map((l) => l.group_id)));
  if (groupIds.length) {
    const { data: groupStudents } = await supabaseAdmin
      .from("students")
      .select(
        "id, first_name, last_name, group_id, parent_telegram_chat_id, parent_notifications_enabled",
      )
      .in("group_id", groupIds);
    const { data: subs } = await supabaseAdmin.from("subjects").select("id, name");
    const subjName: Record<string, string> = Object.fromEntries(
      (subs ?? []).map((s) => [s.id, s.name]),
    );
    for (const lesson of lessons ?? []) {
      const dedupe = `lesson-${lesson.id}-${todayISO}`;
      const st = (groupStudents ?? []).filter((s) => s.group_id === lesson.group_id);
      for (const s of st) {
        const { data: existing } = await supabaseAdmin
          .from("parent_notifications")
          .select("id")
          .eq("student_id", s.id)
          .eq("kind", dedupe)
          .limit(1);
        if (existing && existing.length) {
          results.lesson_skipped++;
          continue;
        }
        const text = `📚 Bugungi dars\n${s.first_name} ${s.last_name ?? ""}\nFan: ${lesson.subject_id ? (subjName[lesson.subject_id] ?? "—") : "—"}\nVaqt: ${String(lesson.start_time).slice(0, 5)}–${String(lesson.end_time).slice(0, 5)}`;
        if (!s.parent_notifications_enabled || !s.parent_telegram_chat_id) {
          await supabaseAdmin.from("parent_notifications").insert({
            student_id: s.id,
            kind: dedupe,
            channel: "telegram",
            payload: { text },
            status: "skipped",
            error: "Chat ID yo'q",
          });
          results.lesson_skipped++;
          continue;
        }
        const r = await sendTelegram(s.parent_telegram_chat_id, text);
        await supabaseAdmin.from("parent_notifications").insert({
          student_id: s.id,
          kind: dedupe,
          channel: "telegram",
          payload: { text },
          status: r.ok ? "sent" : "error",
          error: r.error,
          sent_at: r.ok ? new Date().toISOString() : null,
        });
        if (r.ok) results.lesson_sent++;
        else results.lesson_skipped++;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, ...results }), {
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/cron/reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => runReminders(request),
      POST: async ({ request }) => runReminders(request),
    },
  },
});
