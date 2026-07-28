import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const fmt = (n: number) => Number(n || 0).toLocaleString("uz-UZ");

const METHOD_LABEL: Record<string, string> = {
  cash: "Naqd",
  card: "Bank kartasi",
  qr: "QR to'lov",
  transfer: "Bank o'tkazmasi",
};

async function getRoles(supabase: { from: (t: string) => any }, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return ((data ?? []) as { role: string }[]).map((r) => r.role);
}

async function getBotToken(admin: any): Promise<string> {
  let token = process.env.TELEGRAM_BOT_TOKEN ?? "";
  if (!token) {
    const { data } = await admin.from("settings").select("value").eq("key", "telegram_bot").maybeSingle();
    token = (data?.value as { token?: string } | null)?.token ?? "";
  }
  return token;
}

async function tgSend(token: string, chatId: string, text: string) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    return { ok: !!j.ok, error: j.description ?? (r.ok ? undefined : `HTTP ${r.status}`) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function appBaseUrl() {
  return (process.env.APP_BASE_URL ?? "https://edunestlive.lovable.app").replace(/\/+$/, "");
}

function buildParentMessage(p: {
  student: string; course: string; period: string; amount: number; method: string; date: string;
  receiptUrl: string; real: boolean;
}) {
  const head = p.real ? "✅ <b>To'lov qabul qilindi</b>" : "✅ <b>To'lov qabul qilindi</b>\n⚠️ <i>TEST CHEK — FISKAL EMAS</i>";
  const tail = p.real
    ? `\n\n🧾 Fiskal chek: ${p.receiptUrl}\n\nChekdagi QR-kodni <b>Soliq</b> mobil ilovasida skaner qiling.\n💸 1% keshbek uchun QR-kodni Soliq ilovasida belgilangan muddat ichida ro'yxatdan o'tkazing.`
    : `\n\n🧾 Chek: ${p.receiptUrl}`;
  return `${head}\n\n👤 O'quvchi: ${p.student}\n📚 Kurs: ${p.course}\n📅 To'lov davri: ${p.period}\n💰 Summa: ${fmt(p.amount)} so'm\n💳 To'lov turi: ${p.method}\n🗓 Sana: ${p.date}${tail}`;
}

function periodLabel(d: string) {
  return new Date(d).toLocaleDateString("uz-UZ", { year: "numeric", month: "long" });
}

/* ------------------------------------------------------------------ */
/* cashier context / health                                            */
/* ------------------------------------------------------------------ */

export const getCashierContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const roles = await getRoles(context.supabase, context.userId);
    const isStaff = roles.includes("director") || roles.includes("admin");
    if (!isStaff) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveFiscalProvider } = await import("@/lib/fiscal.server");

    const { data: settings } = await supabaseAdmin
      .from("cash_register_settings").select("*").order("created_at").limit(1).maybeSingle();

    const cfg = {
      providerName: settings?.provider_name ?? "mock",
      cashboxId: settings?.cashbox_id ?? null,
      companyTin: settings?.company_tin ?? null,
      enabled: settings?.enabled ?? false,
      testMode: settings?.test_mode ?? true,
    };
    const { provider, real, reason } = resolveFiscalProvider(cfg);

    let shiftOpen = false;
    let shiftError: string | null = null;
    try {
      shiftOpen = (await provider.getShiftStatus()).open;
    } catch (e) {
      shiftError = (e as Error).message;
    }

    const token = await getBotToken(supabaseAdmin);

    const { data: cashAccounts } = await supabaseAdmin
      .from("cash_accounts")
      .select("id, name, type")
      .eq("is_active", true)
      .order("created_at");

    return {
      settings: settings ?? null,
      cashAccounts: (cashAccounts ?? []) as { id: string; name: string; type: string }[],
      fiscal: {
        real,
        reason: reason ?? null,
        providerName: provider.name,
        shiftOpen,
        shiftError,
      },
      telegram: { configured: !!token },
      printer: { type: settings?.printer_type ?? "browser_80mm" },
      canDiscount: isStaff,
      isDirector: roles.includes("director"),
    };
  });

/* ------------------------------------------------------------------ */
/* create payment + fiscal receipt                                     */
/* ------------------------------------------------------------------ */

const CreateInput = z.object({
  student_id: z.string().uuid(),
  course_id: z.string().uuid().nullable().optional(),
  period_month: z.string().min(7),
  subtotal: z.number().min(0),
  discount_amount: z.number().min(0).default(0),
  discount_reason: z.string().max(300).nullable().optional(),
  payment_method: z.enum(["cash", "card", "qr", "transfer"]),
  fiscalize: z.boolean().default(true),
  notify_parent: z.boolean().default(true),
  idempotency_key: z.string().min(8).max(120),
});

export const createPaymentWithReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const roles = await getRoles(context.supabase, context.userId);
    if (!roles.includes("director") && !roles.includes("admin")) {
      throw new Response("Faqat direktor va administrator to'lov qabul qila oladi", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveFiscalProvider } = await import("@/lib/fiscal.server");

    const total = Math.max(0, data.subtotal - data.discount_amount);
    if (total <= 0) throw new Response("To'lov summasi noldan katta bo'lishi kerak", { status: 400 });

    // idempotency: return existing payment if the key was already used
    const { data: existing } = await supabaseAdmin
      .from("payments").select("id").eq("idempotency_key", data.idempotency_key).maybeSingle();
    if (existing) return await loadResult(supabaseAdmin, existing.id);

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, parent_telegram_chat_id, parent_notifications_enabled, group_id, profile:profiles(full_name)")
      .eq("id", data.student_id).maybeSingle();
    if (!student) throw new Response("O'quvchi topilmadi", { status: 404 });

    const studentName =
      (student as any).profile?.full_name ||
      [student.last_name, student.first_name].filter(Boolean).join(" ") ||
      "O'quvchi";

    let courseName = "Ta'lim xizmati";
    const courseId = data.course_id ?? student.group_id ?? null;
    if (courseId) {
      const { data: g } = await supabaseAdmin.from("groups").select("name, subject:subjects(name)").eq("id", courseId).maybeSingle();
      if (g) courseName = [(g as any).subject?.name, g.name].filter(Boolean).join(" • ") || g.name;
    }

    const period = data.period_month.length === 7 ? `${data.period_month}-01` : data.period_month;

    // 1. persist as processing
    const { data: payment, error: insErr } = await supabaseAdmin
      .from("payments")
      .insert({
        student_id: data.student_id,
        course_id: courseId,
        amount: total,
        subtotal: data.subtotal,
        discount_amount: data.discount_amount,
        discount_reason: data.discount_reason ?? null,
        total_amount: total,
        payment_method: data.payment_method,
        period_month: period,
        status: "pending",
        cashier_id: context.userId,
        idempotency_key: data.idempotency_key,
        fiscal_status: "processing",
      })
      .select("id")
      .single();
    if (insErr || !payment) throw new Response(insErr?.message ?? "To'lovni saqlashda xato", { status: 500 });

    await audit(supabaseAdmin, payment.id, context.userId, "payment_created", null, { total, method: data.payment_method });

    // 2. fiscalize
    let fiscalError: string | null = null;
    let real = false;
    if (data.fiscalize) {
      const { data: settings } = await supabaseAdmin
        .from("cash_register_settings").select("*").order("created_at").limit(1).maybeSingle();
      const resolved = resolveFiscalProvider({
        providerName: settings?.provider_name ?? "mock",
        cashboxId: settings?.cashbox_id ?? null,
        companyTin: settings?.company_tin ?? null,
        enabled: settings?.enabled ?? false,
        testMode: settings?.test_mode ?? true,
      });
      real = resolved.real;
      try {
        const receipt = await resolved.provider.createReceipt({
          idempotencyKey: data.idempotency_key,
          items: [{ name: `${courseName} — ${periodLabel(period)}`, qty: 1, price: data.subtotal, vatPercent: settings?.vat_enabled ? Number(settings.vat_percent ?? 12) : 0 }],
          subtotal: data.subtotal,
          discount: data.discount_amount,
          total,
          paymentMethod: data.payment_method,
          cashierName: context.userId,
          customerName: studentName,
          period: periodLabel(period),
          courseName,
        });

        await supabaseAdmin.from("fiscal_receipts").insert({
          payment_id: payment.id,
          provider_name: receipt.providerName,
          provider_transaction_id: receipt.providerTransactionId,
          receipt_number: receipt.receiptNumber,
          fiscal_sign: receipt.fiscalSign,
          fiscal_qr_data: receipt.qrData,
          receipt_url: receipt.receiptUrl ?? `${appBaseUrl()}/receipt/${payment.id}`,
          cashbox_id: receipt.cashboxId,
          company_tin: settings?.company_tin ?? null,
          test_mode: receipt.testMode,
          raw_response: receipt.raw as never,
          status: "created",
        });

        await supabaseAdmin.from("payments").update({
          fiscal_status: "fiscalized",
          fiscalized_at: new Date().toISOString(),
          status: "paid",
          paid_at: new Date().toISOString(),
        }).eq("id", payment.id);

        await audit(supabaseAdmin, payment.id, context.userId, "fiscalized", null, { receipt_number: receipt.receiptNumber, test: receipt.testMode });
      } catch (e) {
        fiscalError = (e as Error).message;
        await supabaseAdmin.from("payments").update({
          fiscal_status: "fiscal_failed",
          status: "paid",
          paid_at: new Date().toISOString(),
        }).eq("id", payment.id);
        await audit(supabaseAdmin, payment.id, context.userId, "fiscal_failed", null, { error: fiscalError });
      }
    } else {
      await supabaseAdmin.from("payments").update({
        fiscal_status: "draft", status: "paid", paid_at: new Date().toISOString(),
      }).eq("id", payment.id);
    }

    // 3. notify parent — only after a receipt actually exists
    if (data.notify_parent && !fiscalError && data.fiscalize) {
      await enqueueAndSend(supabaseAdmin, payment.id, {
        chatId: student.parent_notifications_enabled ? student.parent_telegram_chat_id : null,
        student: studentName, course: courseName, period: periodLabel(period),
        amount: total, method: METHOD_LABEL[data.payment_method] ?? data.payment_method,
        real,
      });
    }

    const result = await loadResult(supabaseAdmin, payment.id);
    return { ...result, fiscalError };
  });

async function audit(admin: any, paymentId: string, userId: string | null, action: string, oldData: unknown, newData: unknown) {
  await admin.from("payment_audit_log").insert({
    payment_id: paymentId, user_id: userId, action,
    old_data: (oldData ?? null) as never, new_data: (newData ?? null) as never,
  });
}

async function enqueueAndSend(admin: any, paymentId: string, p: {
  chatId: string | null; student: string; course: string; period: string; amount: number; method: string; real: boolean;
}) {
  const { data: rec } = await admin.from("fiscal_receipts").select("receipt_url").eq("payment_id", paymentId).maybeSingle();
  const receiptUrl = rec?.receipt_url ?? `${appBaseUrl()}/receipt/${paymentId}`;
  const text = buildParentMessage({
    student: p.student, course: p.course, period: p.period, amount: p.amount,
    method: p.method, date: new Date().toLocaleDateString("uz-UZ"), receiptUrl, real: p.real,
  });

  const { data: row } = await admin.from("notification_queue").insert({
    payment_id: paymentId, recipient_type: "parent", telegram_chat_id: p.chatId,
    message_text: text, receipt_url: receiptUrl,
    status: p.chatId ? "pending" : "skipped",
    last_error: p.chatId ? null : "Ota-onaning Telegram chat ID topilmadi",
  }).select("id").single();

  if (!p.chatId || !row) return;
  await dispatchQueueRow(admin, row.id);
}

async function dispatchQueueRow(admin: any, queueId: string) {
  const { data: row } = await admin.from("notification_queue").select("*").eq("id", queueId).maybeSingle();
  if (!row || !row.telegram_chat_id) return { ok: false };
  const token = await getBotToken(admin);
  if (!token) {
    await admin.from("notification_queue").update({ status: "pending", attempts: (row.attempts ?? 0) + 1, last_error: "Bot token sozlanmagan" }).eq("id", queueId);
    return { ok: false };
  }
  const res = await tgSend(token, row.telegram_chat_id, row.message_text);
  await admin.from("notification_queue").update({
    status: res.ok ? "sent" : "pending",
    attempts: (row.attempts ?? 0) + 1,
    last_error: res.ok ? null : (res.error ?? "Nomaʼlum xato"),
    sent_at: res.ok ? new Date().toISOString() : null,
  }).eq("id", queueId);
  return res;
}

async function loadResult(admin: any, paymentId: string) {
  const [{ data: payment }, { data: receipt }, { data: notif }] = await Promise.all([
    admin.from("payments").select("*").eq("id", paymentId).maybeSingle(),
    admin.from("fiscal_receipts").select("*").eq("payment_id", paymentId).maybeSingle(),
    admin.from("notification_queue").select("id, status, last_error").eq("payment_id", paymentId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return { payment, receipt, notification: notif ?? null };
}

/* ------------------------------------------------------------------ */
/* retry / resend / refund                                             */
/* ------------------------------------------------------------------ */

export const retryFiscalization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ payment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const roles = await getRoles(context.supabase, context.userId);
    if (!roles.includes("director") && !roles.includes("admin")) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveFiscalProvider } = await import("@/lib/fiscal.server");

    const { data: payment } = await supabaseAdmin.from("payments").select("*").eq("id", data.payment_id).maybeSingle();
    if (!payment) throw new Response("To'lov topilmadi", { status: 404 });
    if (payment.fiscal_status === "fiscalized") throw new Response("Bu to'lov allaqachon fiskallashtirilgan", { status: 409 });

    const { data: dup } = await supabaseAdmin.from("fiscal_receipts").select("id").eq("payment_id", payment.id).maybeSingle();
    if (dup) throw new Response("Chek allaqachon mavjud", { status: 409 });

    const { data: settings } = await supabaseAdmin.from("cash_register_settings").select("*").order("created_at").limit(1).maybeSingle();
    const resolved = resolveFiscalProvider({
      providerName: settings?.provider_name ?? "mock",
      cashboxId: settings?.cashbox_id ?? null,
      companyTin: settings?.company_tin ?? null,
      enabled: settings?.enabled ?? false,
      testMode: settings?.test_mode ?? true,
    });

    const { data: student } = await supabaseAdmin
      .from("students").select("first_name, last_name, parent_telegram_chat_id, parent_notifications_enabled, profile:profiles(full_name)")
      .eq("id", payment.student_id).maybeSingle();
    const studentName = (student as any)?.profile?.full_name || [student?.last_name, student?.first_name].filter(Boolean).join(" ") || "O'quvchi";

    let courseName = "Ta'lim xizmati";
    if (payment.course_id) {
      const { data: g } = await supabaseAdmin.from("groups").select("name").eq("id", payment.course_id).maybeSingle();
      if (g) courseName = g.name;
    }

    try {
      const receipt = await resolved.provider.createReceipt({
        idempotencyKey: payment.idempotency_key ?? payment.id,
        items: [{ name: `${courseName} — ${periodLabel(payment.period_month)}`, qty: 1, price: Number(payment.subtotal || payment.amount) }],
        subtotal: Number(payment.subtotal || payment.amount),
        discount: Number(payment.discount_amount ?? 0),
        total: Number(payment.total_amount || payment.amount),
        paymentMethod: (payment.payment_method ?? "cash") as never,
        cashierName: context.userId,
        customerName: studentName,
        period: periodLabel(payment.period_month),
        courseName,
      });

      await supabaseAdmin.from("fiscal_receipts").insert({
        payment_id: payment.id,
        provider_name: receipt.providerName,
        provider_transaction_id: receipt.providerTransactionId,
        receipt_number: receipt.receiptNumber,
        fiscal_sign: receipt.fiscalSign,
        fiscal_qr_data: receipt.qrData,
        receipt_url: receipt.receiptUrl ?? `${appBaseUrl()}/receipt/${payment.id}`,
        cashbox_id: receipt.cashboxId,
        company_tin: settings?.company_tin ?? null,
        test_mode: receipt.testMode,
        raw_response: receipt.raw as never,
        status: "created",
      });
      await supabaseAdmin.from("payments").update({
        fiscal_status: "fiscalized", fiscalized_at: new Date().toISOString(), status: "paid",
      }).eq("id", payment.id);
      await audit(supabaseAdmin, payment.id, context.userId, "refiscalized", null, { receipt_number: receipt.receiptNumber });

      await enqueueAndSend(supabaseAdmin, payment.id, {
        chatId: student?.parent_notifications_enabled ? student.parent_telegram_chat_id : null,
        student: studentName, course: courseName, period: periodLabel(payment.period_month),
        amount: Number(payment.total_amount || payment.amount),
        method: METHOD_LABEL[payment.payment_method ?? "cash"] ?? "—",
        real: resolved.real,
      });
      return await loadResult(supabaseAdmin, payment.id);
    } catch (e) {
      await audit(supabaseAdmin, payment.id, context.userId, "fiscal_failed", null, { error: (e as Error).message });
      throw new Response(`Virtual kassa bilan aloqa o'rnatilmadi: ${(e as Error).message}`, { status: 502 });
    }
  });

export const resendReceiptTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ payment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const roles = await getRoles(context.supabase, context.userId);
    if (!roles.includes("director") && !roles.includes("admin")) throw new Response("Forbidden", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("notification_queue").select("id, telegram_chat_id")
      .eq("payment_id", data.payment_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row) throw new Response("Yuboriladigan xabar topilmadi", { status: 404 });

    if (!row.telegram_chat_id) {
      const { data: p } = await supabaseAdmin.from("payments").select("student_id").eq("id", data.payment_id).maybeSingle();
      const { data: s } = await supabaseAdmin.from("students").select("parent_telegram_chat_id").eq("id", p?.student_id ?? "").maybeSingle();
      if (!s?.parent_telegram_chat_id) throw new Response("Ota-onaning Telegram chat ID topilmadi", { status: 400 });
      await supabaseAdmin.from("notification_queue").update({ telegram_chat_id: s.parent_telegram_chat_id }).eq("id", row.id);
    }
    const res = await dispatchQueueRow(supabaseAdmin, row.id);
    await audit(supabaseAdmin, data.payment_id, context.userId, "receipt_resent", null, { ok: res.ok });
    if (!res.ok) throw new Response("Telegramga yuborib bo'lmadi, navbatda saqlandi", { status: 502 });
    return { ok: true };
  });

export const refundPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ payment_id: z.string().uuid(), reason: z.string().min(3).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const roles = await getRoles(context.supabase, context.userId);
    if (!roles.includes("director")) throw new Response("Faqat direktor qaytara oladi", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveFiscalProvider } = await import("@/lib/fiscal.server");

    const { data: payment } = await supabaseAdmin.from("payments").select("*").eq("id", data.payment_id).maybeSingle();
    if (!payment) throw new Response("To'lov topilmadi", { status: 404 });
    const { data: receipt } = await supabaseAdmin.from("fiscal_receipts").select("*").eq("payment_id", payment.id).maybeSingle();

    if (receipt?.provider_transaction_id) {
      const { data: settings } = await supabaseAdmin.from("cash_register_settings").select("*").order("created_at").limit(1).maybeSingle();
      const resolved = resolveFiscalProvider({
        providerName: settings?.provider_name ?? "mock",
        cashboxId: settings?.cashbox_id ?? null,
        companyTin: settings?.company_tin ?? null,
        enabled: settings?.enabled ?? false,
        testMode: settings?.test_mode ?? true,
      });
      try {
        await resolved.provider.refundReceipt(receipt.provider_transaction_id, Number(payment.total_amount || payment.amount), data.reason);
        await supabaseAdmin.from("fiscal_receipts").update({ status: "refunded" }).eq("id", receipt.id);
      } catch (e) {
        throw new Response(`Fiskal qaytarish amalga oshmadi: ${(e as Error).message}`, { status: 502 });
      }
    }

    await supabaseAdmin.from("payments").update({ fiscal_status: "refunded", status: "pending" }).eq("id", payment.id);
    await audit(supabaseAdmin, payment.id, context.userId, "refunded", { status: payment.status }, { reason: data.reason });
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* cash register settings (director)                                   */
/* ------------------------------------------------------------------ */

export const saveCashRegisterSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    provider_name: z.string().min(1).max(60),
    cashbox_id: z.string().max(120).nullable().optional(),
    company_tin: z.string().max(20).nullable().optional(),
    company_name: z.string().max(160),
    branch_address: z.string().max(300).nullable().optional(),
    vat_enabled: z.boolean(),
    vat_percent: z.number().min(0).max(50),
    enabled: z.boolean(),
    test_mode: z.boolean(),
    printer_type: z.string().max(40),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const roles = await getRoles(context.supabase, context.userId);
    if (!roles.includes("director")) throw new Response("Faqat direktor sozlay oladi", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("cash_register_settings").select("id").order("created_at").limit(1).maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin.from("cash_register_settings").update(data).eq("id", existing.id);
      if (error) throw new Response(error.message, { status: 500 });
    } else {
      const { error } = await supabaseAdmin.from("cash_register_settings").insert(data);
      if (error) throw new Response(error.message, { status: 500 });
    }
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* public receipt view                                                 */
/* ------------------------------------------------------------------ */

export const getPublicReceipt = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ payment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id, amount, subtotal, discount_amount, total_amount, payment_method, period_month, paid_at, created_at, fiscal_status, student_id, course_id, cashier_id")
      .eq("id", data.payment_id).maybeSingle();
    if (!payment) return null;

    const [{ data: receipt }, { data: settings }, { data: student }] = await Promise.all([
      supabaseAdmin.from("fiscal_receipts").select("receipt_number, fiscal_sign, fiscal_qr_data, receipt_url, cashbox_id, test_mode, provider_name, created_at").eq("payment_id", payment.id).maybeSingle(),
      supabaseAdmin.from("cash_register_settings").select("company_name, company_tin, branch_address, vat_enabled, vat_percent").order("created_at").limit(1).maybeSingle(),
      supabaseAdmin.from("students").select("first_name, last_name, profile:profiles(full_name)").eq("id", payment.student_id).maybeSingle(),
    ]);

    let courseName = "Ta'lim xizmati";
    if (payment.course_id) {
      const { data: g } = await supabaseAdmin.from("groups").select("name").eq("id", payment.course_id).maybeSingle();
      if (g) courseName = g.name;
    }
    let cashierName = "—";
    if (payment.cashier_id) {
      const { data: pr } = await supabaseAdmin.from("profiles").select("full_name").eq("id", payment.cashier_id).maybeSingle();
      cashierName = pr?.full_name ?? "—";
    }

    return {
      payment,
      receipt: receipt ?? null,
      org: settings ?? null,
      studentName: (student as any)?.profile?.full_name || [student?.last_name, student?.first_name].filter(Boolean).join(" ") || "O'quvchi",
      courseName,
      cashierName,
    };
  });
