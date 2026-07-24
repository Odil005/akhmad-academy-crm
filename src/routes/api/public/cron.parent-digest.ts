import { createFileRoute } from "@tanstack/react-router";

// Daily parent digest — enqueues per-student notifications with today's status.
// Called by pg_cron ~20:00 Asia/Tashkent. Actual Telegram delivery happens in
// cron.notifications-dispatch.

async function build() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const today = new Date().toISOString().slice(0, 10);

  const { data: students } = await supabaseAdmin
    .from("students")
    .select("id, first_name, last_name, parent_telegram_chat_id, parent_notifications_enabled, group_id")
    .eq("parent_notifications_enabled", true)
    .not("parent_telegram_chat_id", "is", null);

  let enqueued = 0;
  for (const s of students ?? []) {
    // gather today attendance
    const { data: att } = await supabaseAdmin
      .from("attendance")
      .select("status")
      .eq("student_id", s.id)
      .eq("date", today);

    const { data: grades } = await supabaseAdmin
      .from("grades")
      .select("score, max_score, kind")
      .eq("student_id", s.id)
      .eq("graded_at", today);

    const { data: pending } = await supabaseAdmin
      .from("payments")
      .select("amount, next_due_date, period_month")
      .eq("student_id", s.id)
      .eq("status", "pending");

    const debt = (pending ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const payload = {
      ref_date: today,
      attendance: (att ?? []).map((a) => a.status),
      grades: grades ?? [],
      debt,
      pending_count: pending?.length ?? 0,
    };

    const { error } = await supabaseAdmin
      .from("parent_notifications")
      .insert({
        student_id: s.id,
        kind: "daily_digest",
        channel: "telegram",
        payload,
        status: "pending",
      });
    if (!error) enqueued += 1;
  }

  return { ok: true, enqueued };
}

export const Route = createFileRoute("/api/public/cron/parent-digest")({
  server: {
    handlers: {
      GET: async () => Response.json(await build()),
      POST: async () => Response.json(await build()),
    },
  },
});
