import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Initiate an outbound call via configured SIP trunk. Stub if no provider. */
export const clickToCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      phone: z.string().min(3).max(32),
      contact_type: z.enum(["lead", "student", "parent", "other"]).optional(),
      contact_id: z.string().uuid().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (rolesData ?? []).map((r) => r.role as string);
    if (!roles.some((r) => ["director", "admin", "teacher"].includes(r))) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sip_config")
      .select("provider, api_base_url, username, auth_id, caller_id, is_active")
      .maybeSingle();

    const { data: ext } = await supabaseAdmin
      .from("sip_extensions")
      .select("extension")
      .eq("user_id", userId)
      .maybeSingle();

    // Log the attempt regardless
    const { data: call } = await supabaseAdmin
      .from("calls")
      .insert({
        direction: "outbound",
        phone: data.phone,
        contact_type: data.contact_type ?? "other",
        contact_id: data.contact_id ?? null,
        status: cfg?.is_active ? "queued" : "not_configured",
        called_at: new Date().toISOString(),
        created_by: userId,
        trunk: cfg?.provider ?? null,
        duration_sec: 0,
      })
      .select("id")
      .maybeSingle();

    if (!cfg?.is_active || !cfg.api_base_url) {
      return { ok: false, reason: "sip_not_configured", call_id: call?.id };
    }

    // Forward to provider (generic REST). Provider-specific API keys read from env.
    try {
      const apiKey = process.env.SIP_PROVIDER_API_KEY ?? "";
      const r = await fetch(`${cfg.api_base_url}/originate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          to: data.phone,
          from: cfg.caller_id ?? cfg.username,
          extension: ext?.extension ?? null,
          call_ref: call?.id,
        }),
      });
      const body = await r.json().catch(() => ({}));
      return { ok: r.ok, call_id: call?.id, provider_response: body };
    } catch (e) {
      return { ok: false, reason: "provider_error", error: (e as Error).message, call_id: call?.id };
    }
  });
