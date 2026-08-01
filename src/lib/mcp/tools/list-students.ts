import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_students",
  title: "List students",
  description: "List students in Akhmad Academy, optionally filtered by name or phone.",
  inputSchema: {
    query: z.string().optional().describe("Filter by student first/last name or parent phone."),
    limit: z.number().int().optional().describe("Max rows to return (default 25, max 100)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const take = Math.min(Math.max(limit ?? 25, 1), 100);
    let req = supabase
      .from("students")
      .select("id, first_name, last_name, status, parent_phone, parent_full_name, group_id, enrolled_at")
      .order("enrolled_at", { ascending: false })
      .limit(take);
    if (query?.trim()) {
      const q = query.trim();
      req = req.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,parent_phone.ilike.%${q}%`);
    }
    const { data, error } = await req;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { students: data ?? [] },
    };
  },
});
