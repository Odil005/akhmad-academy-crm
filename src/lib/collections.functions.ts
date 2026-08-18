import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Qarzdorlar ro'yxati — bitta RPC bilan (tez, sahifalash shart emas). */
export const listDebtors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("debtors_overview");
    if (error) throw new Error(error.message);
    const { reminderText } = await import("@/lib/collections.server");
    return (data ?? []).map((row) => ({
      ...row,
      debt_total: Number(row.debt_total ?? 0),
      stage: reminderText({
        student_name: row.student_name,
        debt_total: Number(row.debt_total ?? 0),
        days_overdue: row.days_overdue,
        periods: row.periods,
      }).stage,
    }));
  });

/** Bitta yoki bir nechta qarzdorga kechikish darajasiga mos eslatma yuboradi. */
export const sendDebtReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ student_ids: z.array(z.string().uuid()).min(1).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("debtors_overview");
    if (error) throw new Error(error.message);
    const targets = (rows ?? []).filter((row) => data.student_ids.includes(row.student_id));
    if (!targets.length) return { sent: 0, skipped: 0, errors: [] as string[] };

    const { reminderText } = await import("@/lib/collections.server");
    const { sendTelegramText } = await import("@/lib/telegram.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of targets) {
      if (!row.parent_chat_id) {
        skipped += 1;
        errors.push(`${row.student_name}: ota-ona Telegram ID yo'q`);
        continue;
      }
      const { text, stage } = reminderText({
        student_name: row.student_name,
        debt_total: Number(row.debt_total ?? 0),
        days_overdue: row.days_overdue,
        periods: row.periods,
      });
      const result = await sendTelegramText(row.parent_chat_id, text);
      await supabaseAdmin.from("payment_notifications").insert({
        student_id: row.student_id,
        period_month: row.oldest_period,
        notification_type: `debt_${stage}`,
        parent_chat_id: row.parent_chat_id,
        status: result.ok ? "sent" : "error",
        error: result.ok ? null : result.error,
        payload: { text, days_overdue: row.days_overdue, manual: true },
      });
      if (result.ok) sent += 1;
      else {
        skipped += 1;
        errors.push(`${row.student_name}: ${result.error}`);
      }
    }
    return { sent, skipped, errors };
  });

/** Qarzni bo'lib to'lash rejasi (2-12 bo'lak) va ota-onaga grafikni yuborish. */
export const createPaymentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        student_id: z.string().uuid(),
        total_amount: z.number().positive(),
        parts: z.number().int().min(2).max(12),
        first_due_date: z.string().min(10),
        note: z.string().max(500).optional(),
        notify_parent: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { buildInstallments, money } = await import("@/lib/collections.server");
    const installments = buildInstallments(data.total_amount, data.parts, data.first_due_date);

    const { data: plan, error } = await context.supabase
      .from("payment_plans")
      .insert({
        student_id: data.student_id,
        total_amount: data.total_amount,
        note: data.note ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: insertError } = await context.supabase
      .from("payment_plan_installments")
      .insert(installments.map((item) => ({ ...item, plan_id: plan.id })));
    if (insertError) throw new Error(insertError.message);

    let notified = false;
    if (data.notify_parent) {
      const { data: student } = await context.supabase
        .from("students")
        .select("first_name, last_name, full_name, parent_telegram_chat_id")
        .eq("id", data.student_id)
        .maybeSingle();
      const chatId = student?.parent_telegram_chat_id;
      if (chatId) {
        const name =
          [student?.first_name, student?.last_name].filter(Boolean).join(" ") ||
          student?.full_name ||
          "O'quvchi";
        const text = [
          `📋 To'lov rejasi tuzildi — ${name}`,
          `Jami: ${money(data.total_amount)} so'm`,
          "",
          ...installments.map(
            (item) => `${item.position}) ${item.due_date} — ${money(item.amount)} so'm`,
          ),
          "",
          "Har bo'lak muddatidan oldin eslatma yuboriladi.",
        ].join("\n");
        const { sendTelegramText } = await import("@/lib/telegram.server");
        const result = await sendTelegramText(chatId, text);
        notified = result.ok;
      }
    }
    return { plan_id: plan.id, installments, notified };
  });

/** Tanlangan kun uchun to'lov usuli bo'yicha kutilgan summalar. */
export const getShiftExpected = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ shift_date: z.string().min(10) }).parse(data))
  .handler(async ({ data, context }) => {
    const [{ data: expected, error }, { data: shift }] = await Promise.all([
      context.supabase.rpc("cash_shift_expected", { p_date: data.shift_date }),
      context.supabase.from("cash_shifts").select("*").eq("shift_date", data.shift_date).maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    const totals = { cash: 0, card: 0, online: 0 };
    for (const row of expected ?? []) {
      const method = String(row.method ?? "cash");
      const amount = Number(row.total ?? 0);
      if (method === "cash") totals.cash += amount;
      else if (method === "card") totals.card += amount;
      else totals.online += amount;
    }
    return { totals, shift: shift ?? null };
  });

/** Kassani yopish: farqni hisoblaydi, saqlaydi va direktorga Telegram xulosa yuboradi. */
export const closeCashShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        shift_date: z.string().min(10),
        counted_cash: z.number().min(0),
        counted_card: z.number().min(0),
        counted_online: z.number().min(0),
        note: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: expected, error: expectedError } = await context.supabase.rpc(
      "cash_shift_expected",
      { p_date: data.shift_date },
    );
    if (expectedError) throw new Error(expectedError.message);
    const totals = { cash: 0, card: 0, online: 0 };
    for (const row of expected ?? []) {
      const method = String(row.method ?? "cash");
      const amount = Number(row.total ?? 0);
      if (method === "cash") totals.cash += amount;
      else if (method === "card") totals.card += amount;
      else totals.online += amount;
    }
    const counted = data.counted_cash + data.counted_card + data.counted_online;
    const difference = counted - (totals.cash + totals.card + totals.online);

    const payload = {
      shift_date: data.shift_date,
      expected_cash: totals.cash,
      expected_card: totals.card,
      expected_online: totals.online,
      counted_cash: data.counted_cash,
      counted_card: data.counted_card,
      counted_online: data.counted_online,
      difference,
      note: data.note ?? null,
      closed_by: context.userId,
      closed_at: new Date().toISOString(),
    };
    const { error } = await context.supabase
      .from("cash_shifts")
      .upsert(payload, { onConflict: "shift_date" });
    if (error) throw new Error(error.message);

    const { shiftSummaryText } = await import("@/lib/collections.server");
    const text = shiftSummaryText(payload);
    const { data: recipients } = await context.supabase
      .from("director_report_recipients")
      .select("telegram_chat_id")
      .eq("is_active", true);
    let notified = 0;
    if (recipients?.length) {
      const { sendTelegramText } = await import("@/lib/telegram.server");
      for (const recipient of recipients) {
        const result = await sendTelegramText(recipient.telegram_chat_id, text);
        if (result.ok) notified += 1;
      }
    }
    return { difference, notified, summary: text };
  });
