import { auth, defineMcp } from "@lovable.dev/mcp-js";
import academyOverviewTool from "./tools/academy-overview";
import createLeadTool from "./tools/create-lead";
import listGroupsTool from "./tools/list-groups";
import listLeadsTool from "./tools/list-leads";
import listPaymentsTool from "./tools/list-payments";
import listStudentsTool from "./tools/list-students";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "remix-of-welcome-home",
  title: "Remix of Welcome Home",
  version: "0.1.0",
  instructions:
    "Tools for the Akhmad Academy CRM. Read students, groups, payments and leads, get an academy overview, and create new leads. All data access runs as the signed-in CRM user, so results respect that user's permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    academyOverviewTool,
    listStudentsTool,
    listGroupsTool,
    listPaymentsTool,
    listLeadsTool,
    createLeadTool,
  ],
});
