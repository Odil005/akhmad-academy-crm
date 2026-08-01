import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_lead",
  title: "Create lead",
  description: "Create a new lead (potential student enquiry) in the CRM.",
  inputSchema: {
    name: z.string().trim().describe("Lead full name."),
    phone: z.string().trim().describe("Contact phone number."),
    course: z.string().trim().optional().describe("Course the lead is interested in."),
    source: z.string().trim().optional().describe("Where the lead came from, e.g. instagram, call."),
    note: z.string().trim().optional().describe("Free-form note."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    if (!input.name || !input.phone) {
      return { content: [{ type: "text", text: "name and phone are required" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("leads")
      .insert({
        name: input.name,
        phone: input.phone,
        course: input.course ?? null,
        source: input.source ?? "mcp",
        note: input.note ?? null,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { lead: data } };
  },
});
