import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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

    return await Promise.all(
      ((rows ?? []) as Array<Record<string, any>>).map(async (row) => ({
        ...row,
        declared_amount: row.declared_amount === null ? null : Number(row.declared_amount),
        student_name: nameOf.get(row.student_id)?.name ?? row.parent_name ?? "Noma'lum",
        monthly_fee: nameOf.get(row.student_id)?.monthly_fee ?? 0,
        image_url: await receiptSignedUrl(supabaseAdmin as any, row.storage_path),
      })),
    );
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
    if (receipt.parent_chat_id) {
      const { parentDecisionText } = await import("@/lib/receipts.server");
      const { sendTelegramText } = await import("@/lib/telegram.server");
      const result = await sendTelegramText(
        receipt.parent_chat_id,
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
