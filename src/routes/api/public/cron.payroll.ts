import { createFileRoute } from "@tanstack/react-router";
import { isCronRequestAuthorized, unauthorizedCronResponse } from "@/lib/cron-auth.server";

/**
 * Har oyning 1-sanasida o'tgan oy uchun o'qituvchi oyligini avtomatik yozadi.
 * Allaqachon qo'lda saqlangan (teacher_balance) qatorlarni qayta yozmaydi.
 */
async function run(request: Request): Promise<Response> {
  if (!isCronRequestAuthorized(request)) return unauthorizedCronResponse();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { computePayrollRow } = await import("@/lib/payroll");

  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const period = prev.toISOString().slice(0, 10);

  const { data: base, error } = await supabaseAdmin.rpc("teacher_payroll_preview", {
    p_period: period,
  });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (base ?? []) as Array<Record<string, any>>;
  if (rows.length === 0) return Response.json({ ok: true, period, saved: 0, skipped: 0 });

  const teacherIds = rows.map((r) => String(r.teacher_user_id));
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("teacher_balance")
    .select("teacher_user_id")
    .eq("period_month", period)
    .in("teacher_user_id", teacherIds);
  if (existingError)
    return Response.json({ ok: false, error: existingError.message }, { status: 500 });

  const done = new Set(((existing ?? []) as { teacher_user_id: string }[]).map((r) => r.teacher_user_id));
  const payload = rows
    .filter((row) => !done.has(String(row.teacher_user_id)))
    .map((row) => {
      const computed = computePayrollRow({
        teacher_user_id: String(row.teacher_user_id),
        teacher_name: String(row.teacher_name ?? ""),
        students_count: Number(row.students_count ?? 0),
        expected_total: Number(row.expected_total ?? 0),
        collected_total: Number(row.collected_total ?? 0),
        percent: Number(row.percent ?? 0),
        bonus: Number(row.bonus ?? 0),
        penalty: Number(row.penalty ?? 0),
      });
      return {
        teacher_user_id: computed.teacher_user_id,
        period_month: period,
        percent: computed.percent,
        revenue_base: computed.collected_total,
        percent_earning: computed.percent_earning,
        bonus: computed.bonus,
        penalty: computed.penalty,
        kpi_score: computed.kpi_score,
        salary: computed.salary,
        visible_to_teacher: true,
        note: "Avtomatik hisoblandi",
      };
    });

  if (payload.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("teacher_balance").insert(payload);
    if (insertError)
      return Response.json({ ok: false, error: insertError.message }, { status: 500 });
  }

  return Response.json({ ok: true, period, saved: payload.length, skipped: done.size });
}

export const Route = createFileRoute("/api/public/cron/payroll")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});
