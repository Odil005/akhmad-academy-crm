import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_leads",
  title: "List leads",
  description: "List sales leads (potential students) with status and source.",
  inputSchema: {
    status: z.string().optional().describe("Filter by lead status."),
    limit: z.number().int().optional().describe("Max rows to return (default 25, max 100)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const take = Math.min(Math.max(limit ?? 25, 1), 100);
    let req = supabase
      .from("leads")
      .select("id, name, phone, course, source, status, note, created_at")
      .order("created_at", { ascending: false })
      .limit(take);
    if (status) req = req.eq("status", status);
    const { data, error } = await req;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { leads: data ?? [] },
    };
  },
});
