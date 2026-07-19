import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateUserSchema = z.object({
  username: z.string().min(3).max(64),
  access_code: z.string().min(4).max(64),
  full_name: z.string().min(1),
  phone: z.string().optional().nullable(),
  role: z.enum(["student", "teacher", "admin"]),
  // student-only linkage
  student_id: z.string().uuid().optional().nullable(),
  group_id: z.string().uuid().optional().nullable(),
});

/**
 * Director/Admin only. Creates an auth user with email = `${username}@edunest.local`,
 * password = access_code, assigns role, writes profile + credentials row.
 * For 'admin' role the caller must be director.
 */
export const createManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => CreateUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const username = data.username.trim().toLowerCase();
    const duplicateMessage = `"${username}" foydalanuvchi nomi allaqachon band. Boshqa nom tanlang.`;

    // Role check via has_role
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const callerRoles = (rolesData ?? []).map((r) => r.role);
    const isDirector = callerRoles.includes("director");
    const isAdmin = callerRoles.includes("admin");
    if (!isDirector && !isAdmin) {
      return { ok: false, error: "Bu amal uchun ruxsat yo'q." };
    }
    if (data.role === "admin" && !isDirector) {
      return { ok: false, error: "Admin yaratish faqat direktor uchun ruxsat etilgan." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = `${username}@edunest.local`;

    const [studentCredential, teacherCredential, adminCredential] = await Promise.all([
      supabaseAdmin.from("student_credentials").select("id").eq("username", username).maybeSingle(),
      supabaseAdmin.from("teacher_credentials").select("id").eq("username", username).maybeSingle(),
      supabaseAdmin.from("admin_credentials").select("id").eq("username", username).maybeSingle(),
    ]);

    if (studentCredential.data || teacherCredential.data || adminCredential.data) {
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
            status_enum: "trial",
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
    }

    // Return access_code ONCE for the caller to display; it is not persisted in plaintext.
    return { ok: true, user_id: newUserId, username, access_code: data.access_code };
  });

// Reset access code (director/admin)
export const resetAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      user_id: z.string().uuid(),
      new_code: z.string().min(4).max(64),
      role: z.enum(["student", "teacher", "admin"]),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const callerRoles = (rolesData ?? []).map((r) => r.role);
    const isDirector = callerRoles.includes("director");
    const isAdmin = callerRoles.includes("admin");
    if (!isDirector && !isAdmin) throw new Error("Forbidden");
    if (data.role === "admin" && !isDirector) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.new_code,
    });
    if (error) throw new Error(error.message);

    const updated_at = new Date().toISOString();
    if (data.role === "student") {
      await supabaseAdmin
        .from("student_credentials")
        .update({ access_code: "***", updated_at })
        .eq("auth_user_id", data.user_id);
    } else if (data.role === "teacher") {
      await supabaseAdmin
        .from("teacher_credentials")
        .update({ access_code: "***", updated_at })
        .eq("teacher_user_id", data.user_id);
    } else {
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
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["student", "teacher", "admin"]),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id === userId) {
      return { ok: false, error: "O'zingizni o'chira olmaysiz." };
    }
    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const callerRoles = (rolesData ?? []).map((r) => r.role);
    const isDirector = callerRoles.includes("director");
    if (!isDirector) {
      return { ok: false, error: "Faqat direktor o'chira oladi." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Prevent deleting another director
    const { data: targetRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id);
    if ((targetRoles ?? []).some((r) => r.role === "director")) {
      return { ok: false, error: "Direktorni o'chirib bo'lmaydi." };
    }

    // Delete credentials rows
    if (data.role === "student") {
      await supabaseAdmin.from("student_credentials").delete().eq("auth_user_id", data.user_id);
      await supabaseAdmin.from("students").delete().eq("profile_id", data.user_id);
    } else if (data.role === "teacher") {
      await supabaseAdmin.from("teacher_credentials").delete().eq("teacher_user_id", data.user_id);
    } else {
      await supabaseAdmin.from("admin_credentials").delete().eq("admin_user_id", data.user_id);
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) return { ok: false, error: error.message };

    return { ok: true };
  });
