import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeHost } from "@/lib/tenant-host";
import { z } from "zod";

export type SiteTenant = {
  id: string;
  name: string;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  is_flagship: boolean;
  status: string;
};

const SAFE = "id, name, logo_url, phone, address, is_flagship, status";

/** Public: which center owns the website address this request came to. Null = flagship site. */
export const getSiteTenant = createServerFn({ method: "GET" }).handler(async (): Promise<SiteTenant | null> => {
  const host = normalizeHost(getRequestHeader("x-forwarded-host") ?? getRequestHeader("host"));
  if (!host || !host.includes(".")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("centers")
    .select(SAFE)
    .ilike("custom_domain", host)
    .neq("status", "archived")
    .maybeSingle();
  if (!data || data.is_flagship) return null;
  return data as SiteTenant;
});

/** Signed-in user's own center branding for the CRM shell. */
export const getMyCenterBrand = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SiteTenant | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("user_centers")
      .select("center_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!link?.center_id) return null;
    const { data } = await supabaseAdmin.from("centers").select(SAFE).eq("id", link.center_id).maybeSingle();
    return (data as SiteTenant | null) ?? null;
  });

export type CenterProfile = SiteTenant & { custom_domain: string | null };

/** Signed-in user's own center profile (includes domain, read-only). */
export const getMyCenterProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CenterProfile | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("user_centers")
      .select("center_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!link?.center_id) return null;
    const { data } = await supabaseAdmin
      .from("centers")
      .select("id, name, logo_url, phone, address, is_flagship, status, custom_domain")
      .eq("id", link.center_id)
      .maybeSingle();
    return (data as CenterProfile | null) ?? null;
  });

/** Director/admin updates their own center name, logo, phone and address. */
export const updateMyCenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().trim().min(2).max(120),
        logo_url: z.string().trim().url().max(500).or(z.literal("")).optional().nullable(),
        phone: z.string().trim().max(40).optional().nullable(),
        address: z.string().trim().max(300).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r) => r.role);
    if (!roles.includes("director") && !roles.includes("admin")) {
      throw new Error("Faqat direktor yoki administrator markaz profilini o'zgartiradi");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("user_centers")
      .select("center_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!link?.center_id) throw new Error("Sizga markaz biriktirilmagan");
    const { error } = await supabaseAdmin
      .from("centers")
      .update({
        name: data.name,
        logo_url: data.logo_url || null,
        phone: data.phone || null,
        address: data.address || null,
      })
      .eq("id", link.center_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
