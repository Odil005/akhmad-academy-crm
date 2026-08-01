import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "academy_overview",
  title: "Academy overview",
  description:
    "Summary of the academy: student counts by status, group count, open leads and payment totals for a month.",
  inputSchema: {
    month: z
      .string()
      .optional()
      .describe("Period month as YYYY-MM-01. Defaults to the current month."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ month }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const now = new Date();
    const period =
      month?.trim() || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

    const [students, groups, leads, payments] = await Promise.all([
      supabase.from("students").select("status"),
      supabase.from("groups").select("id"),
      supabase.from("leads").select("status"),
      supabase.from("payments").select("total_amount, status").eq("period_month", period),
    ]);

    const firstError = students.error ?? groups.error ?? leads.error ?? payments.error;
    if (firstError) return { content: [{ type: "text", text: firstError.message }], isError: true };

    const countBy = (rows: { status: string }[] | null) =>
      (rows ?? []).reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      }, {});

    const paid = (payments.data ?? []).filter((p) => p.status === "paid");
    const summary = {
      period_month: period,
      students_total: students.data?.length ?? 0,
      students_by_status: countBy(students.data as { status: string }[] | null),
      groups_total: groups.data?.length ?? 0,
      leads_total: leads.data?.length ?? 0,
      leads_by_status: countBy(leads.data as { status: string }[] | null),
      payments_count: payments.data?.length ?? 0,
      payments_paid_count: paid.length,
      payments_paid_total: paid.reduce((s, p) => s + Number(p.total_amount ?? 0), 0),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary) }],
      structuredContent: summary,
    };
  },
});
