import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const applicationSchema = z.object({
  center_name: z.string().trim().min(2).max(120),
  contact_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(32),
  city: z.string().trim().max(80).optional().nullable(),
  plan_code: z.enum(["start", "pro", "premium"]).optional().nullable(),
  students_estimate: z.number().int().min(0).max(100000).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});

/** Public: centers shown on the UNI CRM entry page (safe columns only). */
export const listPublicCenters = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("centers")
    .select("id, name, slug, logo_url, address, status")
    .neq("status", "archived")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    slug: (c.slug as string | null) ?? null,
    logo_url: (c.logo_url as string | null) ?? null,
    address: (c.address as string | null) ?? null,
    status: (c.status as string) ?? "active",
  }));
});

/** Public: a new learning center asks to join UNI CRM. */
export const submitCenterApplication = createServerFn({ method: "POST" })
  .inputValidator((data) => applicationSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("center_applications").insert({
      center_name: data.center_name,
      contact_name: data.contact_name,
      phone: data.phone,
      city: data.city ?? null,
      plan_code: data.plan_code ?? null,
      students_estimate: data.students_estimate ?? null,
      note: data.note ?? null,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type AuthedContext = { supabase: any; userId: string };

async function requirePlatformOwner(context: AuthedContext) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_owners")
    .select("user_id")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!data) throw new Error("Bu bo'lim faqat platforma egasi uchun");
  return supabaseAdmin;
}

/** First director can claim ownership once, while no owner exists yet. */
export const claimPlatformOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isDirector = ((roles ?? []) as { role: string }[]).some((r) => r.role === "director");
    if (!isDirector) throw new Error("Faqat direktor platforma egasi bo'la oladi");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("platform_owners")
      .select("user_id", { count: "exact", head: true });
    if ((count ?? 0) > 0) throw new Error("Platforma egasi allaqachon belgilangan");

    const { error } = await supabaseAdmin
      .from("platform_owners")
      .insert({ user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPlatformAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: owner }, { count }] = await Promise.all([
      supabaseAdmin.from("platform_owners").select("user_id").eq("user_id", context.userId).maybeSingle(),
      supabaseAdmin.from("platform_owners").select("user_id", { count: "exact", head: true }),
    ]);
    return { isOwner: Boolean(owner), ownerCount: count ?? 0 };
  });

/** Owner dashboard: centers, subscriptions, invoices and pending applications. */
export const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requirePlatformOwner(context);
    const [centers, subs, invoices, plans, apps, students] = await Promise.all([
      admin.from("centers").select("*").order("created_at"),
      admin.from("center_subscriptions").select("*"),
      admin.from("center_invoices").select("*").order("period_month", { ascending: false }).limit(200),
      admin.from("plans").select("*").eq("is_active", true).order("monthly_price"),
      admin.from("center_applications").select("*").order("created_at", { ascending: false }).limit(100),
      admin.from("students").select("center_id"),
    ]);

    const studentCount = new Map<string, number>();
    for (const row of (students.data ?? []) as { center_id: string | null }[]) {
      if (!row.center_id) continue;
      studentCount.set(row.center_id, (studentCount.get(row.center_id) ?? 0) + 1);
    }

    const invoiceRows = (invoices.data ?? []) as any[];
    const subRows = (subs.data ?? []) as any[];

    return {
      plans: (plans.data ?? []) as any[],
      applications: (apps.data ?? []) as any[],
      invoices: invoiceRows,
      centers: ((centers.data ?? []) as any[]).map((c) => {
        const sub = subRows.find((s) => s.center_id === c.id) ?? null;
        const debt = invoiceRows
          .filter((i) => i.center_id === c.id && i.status !== "paid")
          .reduce((sum, i) => sum + Number(i.amount ?? 0), 0);
        return {
          ...c,
          students: studentCount.get(c.id) ?? 0,
          subscription: sub,
          monthly_price: Number(sub?.monthly_price ?? 0),
          period_end: sub?.current_period_end ?? null,
          debt,
        };
      }),
      mrr: subRows
        .filter((s) => s.status === "active")
        .reduce((sum, s) => sum + Number(s.monthly_price ?? 0), 0),
    };
  });

const createCenterSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(60).optional().nullable(),
  phone: z.string().trim().max(32).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  plan_id: z.string().uuid().optional().nullable(),
  application_id: z.string().uuid().optional().nullable(),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** Owner creates a new center (optionally approving an application) with its subscription. */
export const createCenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createCenterSchema.parse(data))
  .handler(async ({ data, context }) => {
    const admin = await requirePlatformOwner(context);

    let plan: any = null;
    if (data.plan_id) {
      const { data: p } = await admin.from("plans").select("*").eq("id", data.plan_id).maybeSingle();
      plan = p;
    }

    const { data: center, error } = await admin
      .from("centers")
      .insert({
        name: data.name,
        slug: data.slug ? slugify(data.slug) : slugify(data.name),
        phone: data.phone ?? null,
        address: data.address ?? null,
        status: "active",
        student_limit: Number(plan?.student_limit ?? 300),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: subError } = await admin.from("center_subscriptions").insert({
      center_id: center.id,
      plan_id: plan?.id ?? null,
      status: "active",
      monthly_price: Number(plan?.monthly_price ?? 0),
    });
    if (subError) throw new Error(subError.message);

    if (data.application_id) {
      await admin
        .from("center_applications")
        .update({
          status: "approved",
          reviewed_by: context.userId,
          reviewed_at: new Date().toISOString(),
          created_center_id: center.id,
        })
        .eq("id", data.application_id);
    }

    return { center_id: center.id as string };
  });

export const setApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "contacted", "rejected"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await requirePlatformOwner(context);
    const { error } = await admin
      .from("center_applications")
      .update({
        status: data.status,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCenterStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        center_id: z.string().uuid(),
        status: z.enum(["active", "grace", "suspended", "archived"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await requirePlatformOwner(context);
    const { error } = await admin
      .from("centers")
      .update({ status: data.status })
      .eq("id", data.center_id);
    if (error) throw new Error(error.message);
    await admin
      .from("center_subscriptions")
      .update({ status: data.status === "active" ? "active" : data.status })
      .eq("center_id", data.center_id);
    return { ok: true };
  });

/** Owner records an offline monthly payment: invoice paid + period extended by a month. */
export const recordCenterPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        center_id: z.string().uuid(),
        amount: z.number().min(0),
        months: z.number().int().min(1).max(12).default(1),
        note: z.string().trim().max(300).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await requirePlatformOwner(context);

    const { data: payment, error } = await admin
      .from("center_payments")
      .insert({
        center_id: data.center_id,
        amount: data.amount,
        provider: "manual",
        state: "paid",
        raw: data.note ? { note: data.note } : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await admin
      .from("center_invoices")
      .update({ status: "paid", paid_at: new Date().toISOString(), provider: "manual" })
      .eq("center_id", data.center_id)
      .neq("status", "paid");

    const { data: sub } = await admin
      .from("center_subscriptions")
      .select("id, current_period_end")
      .eq("center_id", data.center_id)
      .maybeSingle();
    if (sub) {
      const base = new Date(String(sub.current_period_end));
      const from = base.getTime() > Date.now() ? base : new Date();
      from.setMonth(from.getMonth() + data.months);
      await admin
        .from("center_subscriptions")
        .update({ status: "active", current_period_end: from.toISOString().slice(0, 10) })
        .eq("id", sub.id);
    }
    await admin.from("centers").update({ status: "active" }).eq("id", data.center_id);

    return { payment_id: payment.id as string };
  });
