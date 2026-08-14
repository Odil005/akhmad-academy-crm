import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

async function isAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).some((row: { role: string }) => row.role === "admin");
}

export const getJarvisAIStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) {
      return {
        allowed: false as const,
        configured: false,
        provider: null,
        model: null,
      };
    }
    const { publicJarvisAIStatus } = await import("@/lib/jarvis-ai.server");
    return { allowed: true as const, ...publicJarvisAIStatus() };
  });

export const testJarvisAIConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) {
      throw new Response("Faqat administrator uchun", { status: 403 });
    }
    const { probeJarvisAIProvider, resolveJarvisAIProvider } =
      await import("@/lib/jarvis-ai.server");
    const provider = resolveJarvisAIProvider();
    if (!provider) {
      return {
        ok: false as const,
        configured: false as const,
        error: "OPENAI_API_KEY yoki LOVABLE_API_KEY sozlanmagan",
      };
    }
    try {
      await probeJarvisAIProvider(provider);
      return {
        ok: true as const,
        configured: true as const,
        provider: provider.label,
        model: provider.chatModel,
      };
    } catch (error) {
      return {
        ok: false as const,
        configured: true as const,
        provider: provider.label,
        model: provider.chatModel,
        error: error instanceof Error ? error.message : "AI ulanishida xato",
      };
    }
  });
