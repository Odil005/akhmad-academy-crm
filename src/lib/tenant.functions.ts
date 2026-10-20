import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeHost } from "@/lib/tenant-host";

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
