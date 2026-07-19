import { createServerFn } from "@tanstack/react-start";

/**
 * Bootstrap endpoint. Public but strictly one-shot:
 * - If NO director exists → create one and return its fresh credentials once.
 * - If a director already exists → refuse (403). Never returns existing
 *   credentials, never resets an existing director's password.
 *
 * Recovery for a lost director password must be done manually by an operator
 * with database access, not via this public endpoint.
 */
export const createFirstDirector = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rand = (n: number) => {
      const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const buf = new Uint8Array(n);
      crypto.getRandomValues(buf);
      return Array.from(buf, (b) => abc[b % abc.length]).join("");
    };

    // Refuse if a director already exists.
    const { data: existingRoles, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "director")
      .limit(1);
    if (roleErr) throw new Response(roleErr.message, { status: 500 });

    if (existingRoles && existingRoles.length > 0) {
      throw new Response(
        "Director akkaunti allaqachon mavjud. Kirish uchun sizga saqlangan email va kod kerak. Kod yo'qolgan bo'lsa, ma'muriyat bilan bog'laning.",
        { status: 403 },
      );
    }

    // No director yet — create one and return credentials exactly once.
    const suffix = rand(4).toLowerCase();
    const email = `director-${suffix}@edunest.uz`;
    const access_code = rand(10);

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: access_code,
      email_confirm: true,
      user_metadata: { full_name: "Director" },
    });
    if (createErr || !created?.user) {
      throw new Response(createErr?.message ?? "Auth user creation failed", { status: 400 });
    }
    const userId = created.user.id;

    await supabaseAdmin.from("profiles").upsert({ id: userId, full_name: "Director" });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "director" });
    if (insErr) throw new Response(insErr.message, { status: 500 });

    await supabaseAdmin.from("director_credentials").insert({
      director_user_id: userId,
      email,
      access_code: "***",
    });

    return { email, access_code, existing: false };
  });

