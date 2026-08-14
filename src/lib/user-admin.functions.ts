import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canManageAccount, isDirector, isStaff, type AppRole } from "@/lib/authz";
import { z } from "zod";

const CreateUserSchema = z.object({
  username: z.string().min(3).max(64),
  access_code: z.string().min(4).max(64),
  full_name: z.string().min(1),
  phone: z.string().optional().nullable(),
  role: z.enum(["student", "teacher", "admin", "director"]),
  // student-only linkage
  student_id: z.string().uuid().optional().nullable(),
  group_id: z.string().uuid().optional().nullable(),
  status_enum: z.enum(["trial", "active", "frozen", "archived", "left"]).optional().nullable(),
  parent_full_name: z.string().optional().nullable(),
  parent_phone: z.string().optional().nullable(),
  parent_telegram_chat_id: z.string().optional().nullable(),
});

async function rolesOf(supabase: any, userId: string): Promise<AppRole[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return ((data ?? []) as Array<{ role: string }>)
    .map((row) => row.role)
    .filter((role): role is AppRole => ["student", "teacher", "admin", "director"].includes(role));
}

async function targetRolesOf(supabaseAdmin: any, userId: string): Promise<AppRole[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = ((data ?? []) as Array<{ role: string }>)
    .map((row) => row.role)
    .filter((role): role is AppRole => ["student", "teacher", "admin", "director"].includes(role));
  if (!roles.length) throw new Error("Foydalanuvchi roli topilmadi.");
  return roles;
}

/**
 * Director/Admin only. Creates an auth user with email = `${username}@edunest.local`,
 * password = access_code, assigns role, writes profile + credentials row.
 * Admin may create only student/teacher accounts; director manages privileged roles.
 */
export const createManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => CreateUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const username = data.username.trim().toLowerCase();
    const duplicateMessage = `"${username}" foydalanuvchi nomi allaqachon band. Boshqa nom tanlang.`;

    // Role check via has_role
    const callerRoles = await rolesOf(supabase, userId);
    if (!isStaff(callerRoles)) {
      return { ok: false, error: "Bu amal uchun ruxsat yo'q." };
    }
    if (!canManageAccount(callerRoles, data.role)) {
      return { ok: false, error: "Admin faqat o'quvchi va o'qituvchi loginlarini yarata oladi." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = `${username}@edunest.local`;

    const [studentCredential, teacherCredential, adminCredential, directorCredential] =
      await Promise.all([
        supabaseAdmin
          .from("student_credentials")
          .select("id")
          .eq("username", username)
          .maybeSingle(),
        supabaseAdmin
          .from("teacher_credentials")
          .select("id")
          .eq("username", username)
          .maybeSingle(),
        supabaseAdmin.from("admin_credentials").select("id").eq("username", username).maybeSingle(),
        supabaseAdmin
          .from("director_credentials")
          .select("id")
          .eq("email", `${username}@edunest.local`)
          .maybeSingle(),
      ]);

    if (
      studentCredential.data ||
      teacherCredential.data ||
      adminCredential.data ||
      directorCredential.data
    ) {
      return { ok: false, error: duplicateMessage };
    }

    // 1. Create auth user
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.access_code,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone ?? "" },
    });
    if (createErr || !created?.user) {
      const msg = createErr?.message ?? "Auth user creation failed";
      if (/already been registered|already exists|duplicate/i.test(msg)) {
        return { ok: false, error: duplicateMessage };
      }
      return { ok: false, error: msg };
    }

    const newUserId = created.user.id;

    // 2. Profile (upsert – handle_new_user trigger may or may not have run)
    await supabaseAdmin.from("profiles").upsert({
      id: newUserId,
      full_name: data.full_name,
      phone: data.phone ?? null,
    });

    // 3. Roles: replace default 'student' assignment if needed
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: data.role });

    // 4. Credentials row
    if (data.role === "student") {
      let studentId = data.student_id;
      if (!studentId) {
        const { data: st, error: stErr } = await supabaseAdmin
          .from("students")
          .insert({
            profile_id: newUserId,
            group_id: data.group_id ?? null,
            first_name: data.full_name.split(" ")[0] ?? data.full_name,
            last_name: data.full_name.split(" ").slice(1).join(" ") || null,
            status_enum: data.status_enum ?? "trial",
            parent_full_name: data.parent_full_name || null,
            parent_phone: data.parent_phone || null,
            parent_telegram_chat_id: data.parent_telegram_chat_id || null,
          })
          .select("id")
          .single();
        if (stErr) return { ok: false, error: stErr.message };
        studentId = st.id;
      } else {
        const { error: updateStudentErr } = await supabaseAdmin
          .from("students")
          .update({ profile_id: newUserId })
          .eq("id", studentId);
        if (updateStudentErr) return { ok: false, error: updateStudentErr.message };
      }
      const { error: credentialErr } = await supabaseAdmin.from("student_credentials").insert({
        student_id: studentId,
        username,
        access_code: "***",
        auth_user_id: newUserId,
        created_by: userId,
      });
      if (credentialErr) return { ok: false, error: credentialErr.message };
    } else if (data.role === "teacher") {
      const { error: credentialErr } = await supabaseAdmin.from("teacher_credentials").insert({
        teacher_user_id: newUserId,
        username,
        access_code: "***",
        created_by: userId,
      });
      if (credentialErr) return { ok: false, error: credentialErr.message };
    } else if (data.role === "admin") {
      const { error: credentialErr } = await supabaseAdmin.from("admin_credentials").insert({
        admin_user_id: newUserId,
        username,
        access_code: "***",
        created_by: userId,
      });
      if (credentialErr) return { ok: false, error: credentialErr.message };
    } else if (data.role === "director") {
      const { error: credentialErr } = await supabaseAdmin.from("director_credentials").insert({
        director_user_id: newUserId,
        email,
        access_code: "***",
      });
      if (credentialErr) return { ok: false, error: credentialErr.message };
    }

    // Return access_code ONCE for the caller to display; it is not persisted in plaintext.
    return { ok: true, user_id: newUserId, username, access_code: data.access_code };
  });

// Reset access code (director/admin)
export const resetAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        user_id: z.string().uuid(),
        new_code: z.string().min(4).max(64),
        role: z.enum(["student", "teacher", "admin", "director"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const callerRoles = await rolesOf(supabase, userId);
    if (!isStaff(callerRoles)) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Never trust role sent by the browser: resolve the target's real role first.
    const targetRoles = await targetRolesOf(supabaseAdmin, data.user_id);
    if (targetRoles.some((role) => !canManageAccount(callerRoles, role))) {
      throw new Error("Siz administrator yoki direktor loginini yangilay olmaysiz.");
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.new_code,
    });
    if (error) throw new Error(error.message);

    const updated_at = new Date().toISOString();
    if (targetRoles.includes("student")) {
      await supabaseAdmin
        .from("student_credentials")
        .update({ access_code: "***", updated_at })
        .eq("auth_user_id", data.user_id);
    }
    if (targetRoles.includes("teacher")) {
      await supabaseAdmin
        .from("teacher_credentials")
        .update({ access_code: "***", updated_at })
        .eq("teacher_user_id", data.user_id);
    }
    if (targetRoles.includes("director")) {
      await supabaseAdmin
        .from("director_credentials")
        .update({ access_code: "***", updated_at })
        .eq("director_user_id", data.user_id);
    }
    if (targetRoles.includes("admin")) {
      await supabaseAdmin
        .from("admin_credentials")
        .update({ access_code: "***", updated_at })
        .eq("admin_user_id", data.user_id);
    }

    // Return new code ONCE; not persisted in plaintext.
    return { ok: true, access_code: data.new_code };
  });

// Delete a managed user (director only). Removes auth user + credentials + roles.
export const deleteManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum(["student", "teacher", "admin", "director"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id === userId) {
      return { ok: false, error: "O'zingizni o'chira olmaysiz." };
    }
    const callerRoles = await rolesOf(supabase, userId);
    if (!isDirector(callerRoles)) {
      return { ok: false, error: "Faqat direktor o'chira oladi." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const targetRoles = await targetRolesOf(supabaseAdmin, data.user_id);
    // Prevent deleting another director; it protects the highest role from accidents.
    if (targetRoles.includes("director")) {
      return { ok: false, error: "Direktorni o'chirib bo'lmaydi." };
    }

    // Delete every credential record that matches the target's actual roles.
    if (targetRoles.includes("student")) {
      await supabaseAdmin.from("student_credentials").delete().eq("auth_user_id", data.user_id);
      await supabaseAdmin.from("students").delete().eq("profile_id", data.user_id);
    }
    if (targetRoles.includes("teacher")) {
      await supabaseAdmin.from("teacher_credentials").delete().eq("teacher_user_id", data.user_id);
    }
    if (targetRoles.includes("admin")) {
      await supabaseAdmin.from("admin_credentials").delete().eq("admin_user_id", data.user_id);
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) return { ok: false, error: error.message };

    return { ok: true };
  });

/**
 * Director loginlari ro'yxati. `director_credentials` faqat egasi uchun o'qiladigan
 * jadval, shuning uchun ro'yxat server tomonda (direktor/admin tekshirgandan keyin) olinadi.
 */
export const listDirectorLogins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const callerRoles = await rolesOf(supabase, userId);
    if (!isDirector(callerRoles)) {
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("director_credentials")
      .select("id, email, director_user_id")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((r) => r.director_user_id).filter(Boolean);
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as Array<{ id: string; full_name: string | null }> };
    const nameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));

    return (data ?? []).map((r) => ({
      id: r.id,
      username: r.email.replace(/@edunest\.local$/, ""),
      user_id: r.director_user_id,
      label: nameMap.get(r.director_user_id) ?? "Director",
    }));
  });
