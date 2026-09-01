import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
// Server-only modules are imported inside the handler so nothing server-side
// can leak into the client bundle (Cloudflare worker boundary).

const ACTIVITY_LABEL: Record<string, string> = {
  qoniqarsiz: "E'tibor kerak",
  qoniqarli: "Qatnashdi",
  yaxshi: "Faol",
  alo: "Juda faol",
};

export const notifyBehaviorParentNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => value as { evaluationId: string })
  .handler(async ({ data, context }) => {
    const { data: roleRows, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error(roleError.message);
    const roles = (roleRows ?? []).map((row) => row.role as string);
    const isManager = roles.includes("director") || roles.includes("admin");
    const isTeacher = roles.includes("teacher");
    if (!isManager && !isTeacher) throw new Response("Forbidden", { status: 403 });

    const { data: evaluation, error: evaluationError } = await context.supabase
      .from("behavior_evaluations")
      .select("id, student_id, teacher_id, rating, comment, lesson_date")
      .eq("id", data.evaluationId)
      .maybeSingle();
    if (evaluationError) throw new Error(evaluationError.message);
    if (!evaluation || (!isManager && evaluation.teacher_id !== context.userId)) {
      throw new Response("Faollik qaydi topilmadi", { status: 404 });
    }

    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select(
        "id, first_name, last_name, full_name, parent_telegram_chat_id, parent_notifications_enabled",
      )
      .eq("id", evaluation.student_id)
      .maybeSingle();
    if (studentError) throw new Error(studentError.message);
    if (!student?.parent_notifications_enabled || !student.parent_telegram_chat_id) {
      return { status: "skipped" as const, reason: "Ota-ona Telegrami ulanmagan" };
    }

    const refId = evaluation.id;
    let { data: notification } = await supabaseAdmin
      .from("parent_notifications")
      .select("id, status, attempts")
      .eq("student_id", evaluation.student_id)
      .eq("kind", "behavior")
      .contains("payload", { ref_id: refId })
      .maybeSingle();

    if (!notification) {
      const inserted = await supabaseAdmin
        .from("parent_notifications")
        .insert({
          student_id: evaluation.student_id,
          kind: "behavior",
          channel: "telegram",
          status: "pending",
          payload: {
            ref_id: refId,
            rating: evaluation.rating,
            comment: evaluation.comment,
            lesson_date: evaluation.lesson_date,
          },
        })
        .select("id, status, attempts")
        .single();
      if (inserted.error) throw new Error(inserted.error.message);
      notification = inserted.data;
    }

    if (notification.status === "sent") return { status: "sent" as const };
    const claim = await supabaseAdmin
      .from("parent_notifications")
      .update({
        status: "processing",
        processing_started_at: new Date().toISOString(),
        attempts: (notification.attempts ?? 0) + 1,
      })
      .eq("id", notification.id)
      .in("status", ["pending", "failed", "error"])
      .select("id")
      .maybeSingle();
    if (claim.error) throw new Error(claim.error.message);
    if (!claim.data) return { status: "queued" as const };

    const name =
      student.full_name ||
      [student.first_name, student.last_name].filter(Boolean).join(" ") ||
      "O'quvchi";
    const label = ACTIVITY_LABEL[String(evaluation.rating)] ?? "Faollik qaydi";
    const text = [
      `📚 Darsdagi faollik — ${label}`,
      `👤 ${name}`,
      `📅 ${evaluation.lesson_date}`,
      evaluation.comment ? `💬 ${evaluation.comment}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const sent = await sendTelegramText(student.parent_telegram_chat_id, text);
    await supabaseAdmin
      .from("parent_notifications")
      .update({
        status: sent.ok ? "sent" : "pending",
        sent_at: sent.ok ? new Date().toISOString() : null,
        processing_started_at: null,
        error: sent.ok ? null : sent.error,
      })
      .eq("id", notification.id);
    await supabaseAdmin.from("telegram_audit_log").insert({
      subject_kind: "student",
      subject_id: evaluation.student_id,
      action: "behavior_parent_notification",
      chat_id: student.parent_telegram_chat_id,
      success: sent.ok,
      error: sent.ok ? null : sent.error,
      actor_id: context.userId,
    });

    return sent.ok
      ? { status: "sent" as const }
      : { status: "queued" as const, reason: sent.error };
  });
