import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_groups",
  title: "List groups",
  description: "List study groups with schedule and monthly fee.",
  inputSchema: {
    query: z.string().optional().describe("Filter by group name."),
    limit: z.number().int().optional().describe("Max rows to return (default 50, max 100)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const take = Math.min(Math.max(limit ?? 50, 1), 100);
    let req = supabase
      .from("groups")
      .select("id, name, schedule, monthly_fee, subject_id, teacher_id, created_at")
      .order("name")
      .limit(take);
    if (query?.trim()) req = req.ilike("name", `%${query.trim()}%`);
    const { data, error } = await req;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { groups: data ?? [] },
    };
  },
});
