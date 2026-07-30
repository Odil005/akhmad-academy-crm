import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function requireStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.some((r: string) => r === "director" || r === "admin")) {
    throw new Response("Forbidden", { status: 403 });
  }
}

const StudentRow = z.object({
  first_name: z.string().min(1),
  last_name: z.string().optional().default(""),
  parent_full_name: z.string().optional().default(""),
  parent_phone: z.string().optional().default(""),
  group_name: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

const GroupRow = z.object({
  name: z.string().min(1),
  monthly_fee: z.coerce.number().nonnegative().default(0),
  schedule: z.string().optional().default(""),
});

const PaymentRow = z.object({
  student_name: z.string().min(1),
  amount: z.coerce.number().positive(),
  period_month: z.string().min(4), // "YYYY-MM" or "YYYY-MM-DD"
  status: z.enum(["paid", "unpaid", "partial"]).default("paid"),
  note: z.string().optional().default(""),
});

const LeadRow = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  course: z.string().optional().default(""),
  source: z.string().optional().default("excel"),
  note: z.string().optional().default(""),
});

const TeacherRow = z.object({
  full_name: z.string().min(1),
  phone: z.string().optional().default(""),
  subject_name: z.string().optional().default(""),
  group_name: z.string().optional().default(""),
  username: z.string().optional().default(""),
  access_code: z.string().optional().default(""),
});

const Input = z.object({
  kind: z.enum(["students", "groups", "payments", "leads", "teachers"]),
  rows: z.array(z.record(z.string(), z.any())).min(1).max(5000),
});


export const bulkImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);

    let inserted = 0;
    const errors: { row: number; message: string }[] = [];
    const credentials: { full_name: string; username: string; access_code: string }[] = [];

    if (data.kind === "groups") {
      const rows = data.rows.map((r, i) => {
        try { return { ok: true as const, i, v: GroupRow.parse(r) }; }
        catch (e: any) { return { ok: false as const, i, msg: e.message as string }; }
      });
      const good = rows.filter((r) => r.ok).map((r: any) => ({
        name: r.v.name, monthly_fee: r.v.monthly_fee, schedule: r.v.schedule || null,
      }));
      rows.filter((r) => !r.ok).forEach((r: any) => errors.push({ row: r.i + 2, message: r.msg }));
      if (good.length) {
        const { error, count } = await supabase.from("groups").insert(good, { count: "exact" });
        if (error) throw new Response(error.message, { status: 400 });
        inserted = count ?? good.length;
      }
    }

    if (data.kind === "leads") {
      const rows = data.rows.map((r, i) => {
        try { return { ok: true as const, i, v: LeadRow.parse(r) }; }
        catch (e: any) { return { ok: false as const, i, msg: e.message as string }; }
      });
      const good = rows.filter((r) => r.ok).map((r: any) => ({
        name: r.v.name, phone: r.v.phone, course: r.v.course || null,
        source: r.v.source || "excel", note: r.v.note || null, status: "new",
      }));
      rows.filter((r) => !r.ok).forEach((r: any) => errors.push({ row: r.i + 2, message: r.msg }));
      if (good.length) {
        const { error, count } = await supabase.from("leads").insert(good, { count: "exact" });
        if (error) throw new Response(error.message, { status: 400 });
        inserted = count ?? good.length;
      }
    }

    if (data.kind === "students") {
      // Preload groups for name → id mapping.
      const { data: groupsData } = await supabase.from("groups").select("id, name");
      const groupIdByName = new Map<string, string>();
      (groupsData ?? []).forEach((g: { id: string; name: string }) => {
        groupIdByName.set(g.name.trim().toLowerCase(), g.id);
      });

      // Auto-create missing groups so students are always assigned.
      const missing = new Set<string>();
      data.rows.forEach((r) => {
        const gn = String((r as any).group_name ?? "").trim();
        if (gn && !groupIdByName.has(gn.toLowerCase())) missing.add(gn);
      });
      if (missing.size) {
        const { data: madeGroups } = await supabase
          .from("groups")
          .insert([...missing].map((name) => ({ name, monthly_fee: 0 })))
          .select("id, name");
        (madeGroups ?? []).forEach((g: { id: string; name: string }) => {
          groupIdByName.set(g.name.trim().toLowerCase(), g.id);
        });
      }

      const good: any[] = [];
      const enrollFor: { key: string; group_id: string }[] = [];
      data.rows.forEach((r, i) => {
        const parsed = StudentRow.safeParse(r);
        if (!parsed.success) { errors.push({ row: i + 2, message: parsed.error.message }); return; }
        const v = parsed.data;
        const gid = v.group_name ? groupIdByName.get(v.group_name.trim().toLowerCase()) ?? null : null;
        good.push({
          first_name: v.first_name,
          last_name: v.last_name || null,
          parent_full_name: v.parent_full_name || null,
          parent_phone: v.parent_phone || null,
          notes: v.notes || null,
          group_id: gid,
          status: "active",
          status_enum: "active",
          enrolled_at: new Date().toISOString(),
        });
        if (gid) enrollFor.push({ key: `${v.first_name} ${v.last_name}`.trim().toLowerCase(), group_id: gid });
      });
      if (good.length) {
        const { data: madeStudents, error, count } = await supabase
          .from("students")
          .insert(good, { count: "exact" })
          .select("id, first_name, last_name, group_id");
        if (error) throw new Response(error.message, { status: 400 });
        inserted = count ?? good.length;

        // Auto-enroll each imported student into their group.
        const enrollments = (madeStudents ?? [])
          .filter((s: any) => s.group_id)
          .map((s: any) => ({
            student_id: s.id,
            group_id: s.group_id,
            started_at: new Date().toISOString().slice(0, 10),
            status: "active",
          }));
        if (enrollments.length) {
          await supabase.from("student_enrollments").insert(enrollments);
        }
      }
    }

    if (data.kind === "teachers") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { generateUsername, generateAccessCode } = await import("@/lib/credentials");

      const { data: groupsData } = await supabase.from("groups").select("id, name");
      const groupIdByName = new Map<string, string>();
      (groupsData ?? []).forEach((g: { id: string; name: string }) => {
        groupIdByName.set(g.name.trim().toLowerCase(), g.id);
      });
      const { data: subjectsData } = await supabase.from("subjects").select("id, name");
      const subjectIdByName = new Map<string, string>();
      (subjectsData ?? []).forEach((s: { id: string; name: string }) => {
        subjectIdByName.set(s.name.trim().toLowerCase(), s.id);
      });

      for (let i = 0; i < data.rows.length; i++) {
        const parsed = TeacherRow.safeParse(data.rows[i]);
        if (!parsed.success) { errors.push({ row: i + 2, message: parsed.error.message }); continue; }
        const v = parsed.data;
        const parts = v.full_name.trim().split(/\s+/);
        const username = (v.username || generateUsername(parts[0] ?? "", parts.slice(1).join(" "), v.phone)).toLowerCase();
        const accessCode = v.access_code || generateAccessCode();

        const { data: exists } = await supabaseAdmin
          .from("teacher_credentials").select("id").eq("username", username).maybeSingle();
        if (exists) { errors.push({ row: i + 2, message: `Login band: ${username}` }); continue; }

        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: `${username}@edunest.local`,
          password: accessCode,
          email_confirm: true,
          user_metadata: { full_name: v.full_name, phone: v.phone },
        });
        if (createErr || !created?.user) {
          errors.push({ row: i + 2, message: createErr?.message ?? "Foydalanuvchi yaratilmadi" });
          continue;
        }
        const uid = created.user.id;
        await supabaseAdmin.from("profiles").upsert({ id: uid, full_name: v.full_name, phone: v.phone || null });
        await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
        await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "teacher" });
        await supabaseAdmin.from("teacher_credentials").insert({
          teacher_user_id: uid, username, access_code: "***", created_by: userId,
        });

        // Subject + group auto-wiring.
        let subjectId: string | null = null;
        if (v.subject_name) {
          const key = v.subject_name.trim().toLowerCase();
          subjectId = subjectIdByName.get(key) ?? null;
          if (!subjectId) {
            const { data: made } = await supabaseAdmin
              .from("subjects").insert({ name: v.subject_name.trim() }).select("id").single();
            if (made) { subjectId = made.id; subjectIdByName.set(key, made.id); }
          }
        }
        if (v.group_name) {
          const key = v.group_name.trim().toLowerCase();
          let gid = groupIdByName.get(key) ?? null;
          if (!gid) {
            const { data: made } = await supabaseAdmin
              .from("groups")
              .insert({ name: v.group_name.trim(), monthly_fee: 0, subject_id: subjectId, teacher_id: uid })
              .select("id").single();
            if (made) { gid = made.id; groupIdByName.set(key, made.id); }
          } else {
            await supabaseAdmin.from("groups").update({ teacher_id: uid, subject_id: subjectId ?? undefined }).eq("id", gid);
          }
        }

        credentials.push({ full_name: v.full_name, username, access_code: accessCode });
        inserted++;
      }
    }


    if (data.kind === "payments") {
      const { data: studentsData } = await supabase
        .from("students").select("id, first_name, last_name");
      const idByName = new Map<string, string>();
      (studentsData ?? []).forEach((s: any) => {
        const key = `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim().toLowerCase();
        if (key) idByName.set(key, s.id);
      });

      const good: any[] = [];
      data.rows.forEach((r, i) => {
        const parsed = PaymentRow.safeParse(r);
        if (!parsed.success) { errors.push({ row: i + 2, message: parsed.error.message }); return; }
        const v = parsed.data;
        const sid = idByName.get(v.student_name.trim().toLowerCase());
        if (!sid) { errors.push({ row: i + 2, message: `O'quvchi topilmadi: ${v.student_name}` }); return; }
        // Normalize period: accept "YYYY-MM" → first day.
        const periodMonth = /^\d{4}-\d{2}$/.test(v.period_month) ? `${v.period_month}-01` : v.period_month;
        good.push({
          student_id: sid,
          amount: v.amount,
          period_month: periodMonth,
          status: v.status,
          paid_at: v.status === "paid" ? new Date().toISOString() : null,
          note: v.note || null,
        });
      });
      if (good.length) {
        const { error, count } = await supabase.from("payments").insert(good, { count: "exact" });
        if (error) throw new Response(error.message, { status: 400 });
        inserted = count ?? good.length;
      }
    }

    return { inserted, errors, credentials, total: data.rows.length };
  });
