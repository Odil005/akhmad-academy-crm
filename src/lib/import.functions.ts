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

      const good: any[] = [];
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
      });
      if (good.length) {
        const { error, count } = await supabase.from("students").insert(good, { count: "exact" });
        if (error) throw new Response(error.message, { status: 400 });
        inserted = count ?? good.length;
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

    return { inserted, errors, total: data.rows.length };
  });
