import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function requireFinanceStaff(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const roles = ((data ?? []) as { role: string }[]).map((r) => r.role);
  if (!roles.includes("admin") && !roles.includes("director")) {
    throw new Error("Oylik hisob-kitobini faqat administrator va direktor ko'radi");
  }
  return roles;
}

const periodSchema = z.object({ period_month: z.string().min(7) });

/**
 * KPI basis: active students in the teacher's groups x the fee set per student.
 * `collected_total` is what parents actually paid for that period.
 */
export const getPayrollPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => periodSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireFinanceStaff(context);
    const period = `${data.period_month.slice(0, 7)}-01`;
    const { data: rows, error } = await context.supabase.rpc("teacher_payroll_preview", {
      p_period: period,
    });
    if (error) throw new Error(error.message);

    const { computePayrollRow } = await import("@/lib/payroll");
    return {
      period,
      rows: ((rows ?? []) as Array<Record<string, any>>).map((row) =>
        computePayrollRow({
          teacher_user_id: row.teacher_user_id,
          teacher_name: row.teacher_name,
          students_count: Number(row.students_count ?? 0),
          expected_total: Number(row.expected_total ?? 0),
          collected_total: Number(row.collected_total ?? 0),
          percent: Number(row.percent ?? 0),
          bonus: Number(row.bonus ?? 0),
          penalty: Number(row.penalty ?? 0),
        }),
      ),
    };
  });

/** Write the calculated salary (percent of collected + bonus − penalty) into teacher_balance. */
export const applyPayroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    periodSchema
      .extend({
        rows: z
          .array(
            z.object({
              teacher_user_id: z.string().uuid(),
              percent: z.number().min(0).max(100),
              bonus: z.number().min(0).default(0),
              penalty: z.number().min(0).default(0),
              visible_to_teacher: z.boolean().default(true),
              note: z.string().max(300).optional(),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireFinanceStaff(context);
    const period = `${data.period_month.slice(0, 7)}-01`;

    const { data: base, error } = await context.supabase.rpc("teacher_payroll_preview", {
      p_period: period,
    });
    if (error) throw new Error(error.message);
    const baseByTeacher = new Map(
      ((base ?? []) as Array<Record<string, any>>).map((row) => [row.teacher_user_id, row]),
    );

    const { computePayrollRow } = await import("@/lib/payroll");
    const payload = data.rows.map((row) => {
      const src = baseByTeacher.get(row.teacher_user_id);
      const computed = computePayrollRow({
        teacher_user_id: row.teacher_user_id,
        teacher_name: String(src?.teacher_name ?? ""),
        students_count: Number(src?.students_count ?? 0),
        expected_total: Number(src?.expected_total ?? 0),
        collected_total: Number(src?.collected_total ?? 0),
        percent: row.percent,
        bonus: row.bonus,
        penalty: row.penalty,
      });
      return {
        teacher_user_id: row.teacher_user_id,
        period_month: period,
        percent: row.percent,
        revenue_base: computed.collected_total,
        percent_earning: computed.percent_earning,
        bonus: row.bonus,
        penalty: row.penalty,
        kpi_score: computed.kpi_score,
        salary: computed.salary,
        visible_to_teacher: row.visible_to_teacher,
        note: row.note ?? null,
      };
    });

    const { error: upsertError } = await context.supabase
      .from("teacher_balance")
      .upsert(payload, { onConflict: "teacher_user_id,period_month" });
    if (upsertError) throw new Error(upsertError.message);

    return { saved: payload.length, period };
  });
