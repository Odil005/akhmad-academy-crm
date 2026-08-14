import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getGitHubAutomationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    if (!(roles ?? []).some((row) => row.role === "admin")) {
      return {
        allowed: false as const,
        configured: false,
        connected: false,
        repository: "",
        baseBranch: "main",
        autoCode: false,
      };
    }
    const { probeGitHubAutomation } = await import("@/lib/github-automation.server");
    return { allowed: true as const, ...(await probeGitHubAutomation()) };
  });
