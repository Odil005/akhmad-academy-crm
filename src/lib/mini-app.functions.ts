import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateAccessCode, generateUsername, usernameToEmail } from "@/lib/credentials";
import { normalizeParentPhone } from "@/lib/parent-portal";

const InitData = z.string().min(10).max(8192);

async function verifiedTelegramUser(initData: string) {
  const { verifyInitData } = await import("@/lib/telegram-webapp");
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const user = await verifyInitData(initData, token);
  if (!user) throw new Error("Ilovani Telegram bot ichidan oching.");
  return user;
}

async function magicLinkFor(admin: any, userId: string): Promise<string> {
  const { data: u } = await admin.auth.admin.getUserById(userId);
  const email = u?.user?.email as string | undefined;
  if (!email) throw new Error("Hisob topilmadi");
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token as string | undefined;
  if (error || !tokenHash) throw new Error("Kirish tokenini yaratib bo'lmadi");
  return tokenHash;
}

async function ensureParentAccount(admin: any, phone: string): Promise<string> {
  const { data: account } = await admin.from("parent_accounts").select("user_id").eq("phone", phone).maybeSingle();
  let userId: string | null = account?.user_id ?? null;
  if (!userId) {
    const buf = new Uint8Array(24);
    crypto.getRandomValues(buf);
    const { data: created, error } = await admin.auth.admin.createUser({
      email: `parent.${phone}@parents.akhmadacademy.local`,
      password: Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("") + "Aa1!",
      email_confirm: true,
      user_metadata: { full_name: "Ota-ona", phone: `+998${phone}` },
    });
    if (error || !created?.user) throw new Error("Hisob yaratib bo'lmadi");
    userId = created.user.id as string;
    await admin.from("parent_accounts").insert({ user_id: userId, phone });
  }
  await admin.from("user_roles").upsert({ user_id: userId, role: "parent" }, { onConflict: "user_id,role", ignoreDuplicates: true });
  return userId!;
}

export type MiniAppEntry =
  | { kind: "staff" | "parent" | "student" | "applicant"; tokenHash: string; next: string }
  | { kind: "rejected"; reason: string | null }
  | { kind: "new"; firstName: string; lastName: string };

/** Public: identifies the Telegram user from signed initData and issues a one-time sign-in token. */
export const miniAppEnter = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: InitData }).parse(d))
  .handler(async ({ data }): Promise<MiniAppEntry> => {
    const tg = await verifiedTelegramUser(data.initData);
    const chat = String(tg.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: staff } = await admin.from("staff_telegram_links").select("user_id").eq("telegram_chat_id", chat).limit(1).maybeSingle();
    if (staff?.user_id) return { kind: "staff", tokenHash: await magicLinkFor(admin, staff.user_id), next: "/dashboard" };

    const { data: app } = await admin
      .from("student_applications")
      .select("status, auth_user_id, role, reject_reason")
      .eq("telegram_user_id", tg.id)
      .maybeSingle();
    if (app?.status === "rejected") return { kind: "rejected", reason: app.reject_reason };
    if (app?.status === "approved" && app.role === "student" && app.auth_user_id)
      return { kind: "student", tokenHash: await magicLinkFor(admin, app.auth_user_id), next: "/dashboard" };

    const { data: kid } = await admin.from("students").select("parent_phone").eq("parent_telegram_chat_id", chat).limit(1).maybeSingle();
    const phone = normalizeParentPhone(kid?.parent_phone);
    if (phone.length === 9) {
      const uid = await ensureParentAccount(admin, phone);
      return { kind: "parent", tokenHash: await magicLinkFor(admin, uid), next: "/ota-ona" };
    }

    if (app?.auth_user_id) return { kind: "applicant", tokenHash: await magicLinkFor(admin, app.auth_user_id), next: "/tg" };
    return { kind: "new", firstName: tg.first_name ?? "", lastName: tg.last_name ?? "" };
  });

/** Public: a new Telegram user applies; login is created at once but has no role until an admin approves. */
export const miniAppRegister = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        initData: InitData,
        role: z.enum(["student", "parent"]),
        firstName: z.string().trim().min(2).max(60),
        lastName: z.string().trim().min(2).max(60),
        phone: z.string().trim().min(9).max(20),
        subject: z.string().trim().max(80).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const tg = await verifiedTelegramUser(data.initData);
    const phone = normalizeParentPhone(data.phone);
    if (phone.length !== 9) throw new Error("Telefon raqamni to'liq kiriting");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: existing } = await admin.from("student_applications").select("auth_user_id").eq("telegram_user_id", tg.id).maybeSingle();
    if (existing) throw new Error("Siz allaqachon ariza topshirgansiz. Ilovani qayta oching.");

    let username = generateUsername(data.firstName, data.lastName, phone);
    for (let i = 0; i < 5; i++) {
      const { data: taken } = await admin.from("student_applications").select("id").eq("username", username).maybeSingle();
      const { data: takenCred } = await admin.from("student_credentials").select("id").eq("username", username).maybeSingle();
      if (!taken && !takenCred) break;
      username = `${username.replace(/\d+$/, "")}${Math.floor(1000 + Math.random() * 9000)}`;
    }
    const password = generateAccessCode(8);
    const fullName = `${data.firstName} ${data.lastName}`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email: usernameToEmail(username),
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: `+998${phone}` },
    });
    if (error || !created?.user) throw new Error("Login yaratib bo'lmadi, qayta urinib ko'ring.");
    const uid = created.user.id as string;
    // No role is granted here: an applicant cannot read any CRM data until approved.
    await admin.from("user_roles").delete().eq("user_id", uid);

    const { error: insErr } = await admin.from("student_applications").insert({
      telegram_user_id: tg.id,
      telegram_chat_id: String(tg.id),
      telegram_username: tg.username ?? null,
      role: data.role,
      first_name: data.firstName,
      last_name: data.lastName,
      phone: `+998${phone}`,
      subject: data.subject || null,
      auth_user_id: uid,
      username,
    });
    if (insErr) {
      await admin.auth.admin.deleteUser(uid);
      throw new Error("Arizani saqlab bo'lmadi");
    }

    const { sendTelegramText } = await import("@/lib/telegram.server");
    await sendTelegramText(
      tg.id,
      `✅ Arizangiz qabul qilindi.\n\nLogin: ${username}\nParol: ${password}\n\nAdministrator tasdiqlagach guruhga qo'shilasiz. Parolni hech kimga bermang.`,
    );
    return { tokenHash: await magicLinkFor(admin, uid) };
  });

/** Signed-in applicant: own application status (RLS: own row only). */
export const myApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("student_applications")
      .select("first_name, last_name, role, subject, status, username, created_at")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    return data as null | { first_name: string; last_name: string | null; role: string; subject: string | null; status: string; username: string | null; created_at: string };
  });

async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("admin") && !roles.includes("director")) throw new Error("Bu amal faqat administrator uchun.");
}

export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("student_applications")
      .select("id, role, first_name, last_name, phone, subject, status, username, telegram_username, created_at, reject_reason")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string; role: string; first_name: string; last_name: string | null; phone: string | null; subject: string | null;
      status: string; username: string | null; telegram_username: string | null; created_at: string; reject_reason: string | null;
    }>;
  });

export const decideApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        approve: z.boolean(),
        groupId: z.string().uuid().optional().nullable(),
        reason: z.string().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    // Read through the caller's RLS so admins only touch their own center's applications.
    const { data: app } = await (context.supabase as any).from("student_applications").select("*").eq("id", data.id).maybeSingle();
    if (!app) throw new Error("Ariza topilmadi");
    if (app.status !== "pending") throw new Error("Bu ariza allaqachon ko'rib chiqilgan");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { sendTelegramText } = await import("@/lib/telegram.server");
    const decided = { decided_by: context.userId, decided_at: new Date().toISOString() };

    if (!data.approve) {
      await admin.from("student_applications").update({ status: "rejected", reject_reason: data.reason || null, ...decided }).eq("id", app.id);
      await sendTelegramText(app.telegram_chat_id, `Arizangiz rad etildi.${data.reason ? `\nSabab: ${data.reason}` : ""}`);
      return { ok: true };
    }

    if (app.role === "student") {
      if (!data.groupId) throw new Error("Guruhni tanlang");
      const { data: group } = await (context.supabase as any).from("groups").select("id, name").eq("id", data.groupId).maybeSingle();
      if (!group) throw new Error("Guruh topilmadi");
      const { data: st, error: stErr } = await admin
        .from("students")
        .insert({
          profile_id: app.auth_user_id,
          center_id: app.center_id,
          group_id: group.id,
          first_name: app.first_name,
          last_name: app.last_name,
          telegram_chat_id: app.telegram_chat_id,
          telegram_username: app.telegram_username,
          notes: app.phone ? `Telegram ariza, tel: ${app.phone}` : "Telegram ariza",
          status_enum: "active",
        })
        .select("id")
        .single();
      if (stErr) throw new Error(stErr.message);
      await admin.from("student_credentials").insert({
        student_id: st.id, username: app.username, access_code: "***", auth_user_id: app.auth_user_id, created_by: context.userId,
      });
      await admin.from("user_roles").upsert({ user_id: app.auth_user_id, role: "student" }, { onConflict: "user_id,role", ignoreDuplicates: true });
      if (app.center_id) await admin.from("user_centers").upsert({ user_id: app.auth_user_id, center_id: app.center_id }, { onConflict: "user_id,center_id", ignoreDuplicates: true });
      await admin.from("student_applications").update({ status: "approved", student_id: st.id, group_id: group.id, ...decided }).eq("id", app.id);
      await sendTelegramText(app.telegram_chat_id, `🎉 Tasdiqlandingiz! Siz "${group.name}" guruhiga qo'shildingiz. Ilovani qayta oching.`);
      return { ok: true };
    }

    // Parent: link this Telegram chat to children whose parent phone matches.
    const phone = normalizeParentPhone(app.phone);
    const { data: kids } = await admin.rpc("telegram_students_by_parent_phone", { p_phone: phone });
    const ids = ((kids ?? []) as any[])
      .filter((s) => [s.parent_phone, ...(s.parent_phones ?? [])].some((p: string) => normalizeParentPhone(p) === phone))
      .map((s) => s.id);
    if (!ids.length) throw new Error("Bu telefon raqamli o'quvchi topilmadi. Avval o'quvchi profilida ota-ona raqamini kiriting.");
    await admin.from("students").update({ parent_telegram_chat_id: app.telegram_chat_id, parent_notifications_enabled: true }).in("id", ids);
    await admin.from("student_applications").update({ status: "approved", ...decided }).eq("id", app.id);
    await sendTelegramText(app.telegram_chat_id, "🎉 Tasdiqlandingiz! Ilovani qayta oching — farzandingiz ma'lumotlari ko'rinadi.");
    return { ok: true };
  });
