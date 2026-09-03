import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ReceiptRow = {
  id: string;
  student_id: string | null;
  parent_chat_id: string | null;
  parent_name: string | null;
  status: string;
  note: string | null;
  review_note: string | null;
  period_month: string;
  payment_method: string | null;
  created_at: string;
  declared_amount: number | null;
  student_name: string;
  monthly_fee: number;
  image_url: string | null;
};

/** Only administrator and director may see or decide on parent receipts. */

async function requireFinanceStaff(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const roles = ((data ?? []) as { role: string }[]).map((r) => r.role);
  if (!roles.includes("admin") && !roles.includes("director")) {
    throw new Error("Bu bo'limni faqat administrator va direktor ko'radi");
  }
  return roles;
}

/** Pending/decided parent receipts with a short-lived image link. */
export const listPaymentReceipts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ status: z.enum(["pending", "approved", "rejected", "all"]).default("pending") })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireFinanceStaff(context);

    let query = context.supabase
      .from("payment_receipts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.status !== "all") query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const studentIds = Array.from(
      new Set(((rows ?? []) as Array<{ student_id: string | null }>).map((r) => r.student_id).filter(Boolean)),
    ) as string[];
    const students = studentIds.length
      ? (
          await context.supabase
            .from("students")
            .select("id, first_name, last_name, full_name, monthly_fee, group_id")
            .in("id", studentIds)
        ).data ?? []
      : [];
    const nameOf = new Map(
      (students as Array<{ id: string; first_name: string | null; last_name: string | null; full_name: string | null; monthly_fee: number | null }>).map(
        (s) => [
          s.id,
          {
            name:
              [s.first_name, s.last_name].filter(Boolean).join(" ") || s.full_name || "Noma'lum",
            monthly_fee: Number(s.monthly_fee ?? 0),
          },
        ],
      ),
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { receiptSignedUrl } = await import("@/lib/receipts.server");

    const list: ReceiptRow[] = await Promise.all(
      ((rows ?? []) as Array<Record<string, any>>).map(async (row) => ({
        id: String(row.id),
        student_id: row.student_id ?? null,
        parent_chat_id: row.parent_chat_id ?? null,
        parent_name: row.parent_name ?? null,
        status: String(row.status ?? "pending"),
        note: row.note ?? null,
        review_note: row.review_note ?? null,
        period_month: String(row.period_month ?? ""),
        payment_method: row.payment_method ?? null,
        created_at: String(row.created_at ?? new Date().toISOString()),
        declared_amount: row.declared_amount === null ? null : Number(row.declared_amount),
        student_name: nameOf.get(row.student_id)?.name ?? row.parent_name ?? "Noma'lum",
        monthly_fee: nameOf.get(row.student_id)?.monthly_fee ?? 0,
        image_url: await receiptSignedUrl(supabaseAdmin as any, row.storage_path),
      })),
    );
    return list;
  });


/** Approve (creates a paid payment) or reject a parent receipt, then notify the parent. */
export const reviewPaymentReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        receipt_id: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        amount: z.number().positive().optional(),
        payment_method: z.enum(["cash", "card", "qr", "transfer", "online"]).default("card"),
        period_month: z.string().min(10).optional(),
        note: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireFinanceStaff(context);

    const { data: receipt, error } = await context.supabase
      .from("payment_receipts")
      .select("*")
      .eq("id", data.receipt_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!receipt) throw new Error("Chek topilmadi");
    if (receipt.status !== "pending") throw new Error("Bu chek allaqachon ko'rib chiqilgan");

    const { data: student } = receipt.student_id
      ? await context.supabase
          .from("students")
          .select("id, first_name, last_name, full_name, monthly_fee, parent_telegram_chat_id")
          .eq("id", receipt.student_id)
          .maybeSingle()
      : { data: null };

    const studentName =
      [student?.first_name, student?.last_name].filter(Boolean).join(" ") ||
      student?.full_name ||
      receipt.parent_name ||
      "O'quvchi";

    let paymentId: string | null = null;
    let amount = 0;

    if (data.decision === "approve") {
      if (!receipt.student_id) throw new Error("Chek o'quvchiga bog'lanmagan — avval o'quvchini tanlang");
      amount = Number(
        data.amount ?? receipt.declared_amount ?? student?.monthly_fee ?? 0,
      );
      if (!amount) throw new Error("Summani kiriting");
      const period = data.period_month ?? receipt.period_month;

      const { data: payment, error: payError } = await context.supabase
        .from("payments")
        .insert({
          student_id: receipt.student_id,
          amount,
          subtotal: amount,
          total_amount: amount,
          status: "paid",
          payment_method: data.payment_method,
          period_month: period,
          paid_at: new Date().toISOString(),
          cashier_id: context.userId,
          note: `Ota-ona cheki asosida tasdiqlandi${data.note ? ` — ${data.note}` : ""}`,
        })
        .select("id")
        .single();
      if (payError) throw new Error(payError.message);
      paymentId = payment.id;
    }

    const { error: updateError } = await context.supabase
      .from("payment_receipts")
      .update({
        status: data.decision === "approve" ? "approved" : "rejected",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        review_note: data.note ?? null,
        payment_id: paymentId,
      })
      .eq("id", data.receipt_id);
    if (updateError) throw new Error(updateError.message);

    let notified = false;
    const parentChatId = receipt.parent_chat_id ?? student?.parent_telegram_chat_id ?? null;
    if (parentChatId) {
      const { parentDecisionText } = await import("@/lib/receipts.server");
      const { sendTelegramText } = await import("@/lib/telegram.server");
      const result = await sendTelegramText(
        String(parentChatId),
        parentDecisionText(data.decision === "approve", {
          studentName,
          amount,
          note: data.note ?? null,
        }),
      );
      notified = result.ok;
    }

    return { payment_id: paymentId, notified };
  });

export type NotificationFailure = {
  id: string;
  source: "queue" | "parent";
  kind: string;
  status: string;
  attempts: number;
  error: string | null;
  student_name: string;
  created_at: string;
};

/** Failed / stuck parent notifications so staff see which message never arrived. */
export const listNotificationFailures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationFailure[]> => {
    await requireFinanceStaff(context);
    const { supabase } = context;

    const [queue, parents] = await Promise.all([
      supabase
        .from("notification_queue")
        .select("id, status, attempts, last_error, created_at, payment_id")
        .in("status", ["pending", "failed"])
        .gte("attempts", 1)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("parent_notifications")
        .select("id, kind, status, error, created_at, student:students(full_name, first_name, last_name)")
        .in("status", ["failed", "error"])
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const rows: NotificationFailure[] = [];
    for (const row of (queue.data ?? []) as any[]) {
      rows.push({
        id: row.id,
        source: "queue",
        kind: "To'lov cheki",
        status: row.status,
        attempts: Number(row.attempts ?? 0),
        error: row.last_error ?? null,
        student_name: row.payment_id ? `To'lov ${String(row.payment_id).slice(0, 8)}` : "—",
        created_at: row.created_at,
      });
    }
    for (const row of (parents.data ?? []) as any[]) {
      const s = row.student as { full_name?: string; first_name?: string; last_name?: string } | null;
      rows.push({
        id: row.id,
        source: "parent",
        kind: row.kind ?? "Ota-ona xabari",
        status: row.status,
        attempts: 0,
        error: row.error ?? null,
        student_name:
          s?.full_name || [s?.first_name, s?.last_name].filter(Boolean).join(" ") || "—",
        created_at: row.created_at,
      });
    }
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return rows;
  });

/** Re-queue one failed notification so the cron retries it. */
export const retryNotificationFailure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), source: z.enum(["queue", "parent"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireFinanceStaff(context);
    const { error } =
      data.source === "queue"
        ? await context.supabase
            .from("notification_queue")
            .update({ status: "pending", attempts: 0, last_error: null })
            .eq("id", data.id)
        : await context.supabase
            .from("parent_notifications")
            .update({ status: "pending", error: null })
            .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
