import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_payments",
  title: "List payments",
  description: "List recent payments with amount, method, status and period.",
  inputSchema: {
    student_id: z.string().optional().describe("Filter to one student id."),
    status: z.string().optional().describe("Filter by payment status, e.g. paid or pending."),
    limit: z.number().int().optional().describe("Max rows to return (default 25, max 100)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ student_id, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const take = Math.min(Math.max(limit ?? 25, 1), 100);
    let req = supabase
      .from("payments")
      .select(
        "id, student_id, amount, total_amount, discount_amount, payment_method, status, period_month, paid_at, created_at, fiscal_status",
      )
      .order("created_at", { ascending: false })
      .limit(take);
    if (student_id) req = req.eq("student_id", student_id);
    if (status) req = req.eq("status", status);
    const { data, error } = await req;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { payments: data ?? [] },
    };
  },
});
