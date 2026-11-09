import { supabase } from "@/integrations/supabase/client";
import { getMyCenterProfile } from "@/lib/tenant.functions";
import { printReceipt58, receiptNextDue } from "@/lib/receipt-58";
import { centerSiteFromLocation, loadReceiptExtras } from "@/lib/receipt-extras";

export type ReceiptPayment = {
  id: string;
  student_id: string;
  course_id: string | null;
  course_name: string | null;
  period_month: string;
  subtotal: number | null;
  total_amount: number | null;
  amount: number;
  discount_amount: number | null;
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
  cashier_id: string | null;
};

/** Payments that represent money actually received can be (re)printed; invoices and voided rows cannot. */
export function canPrintReceipt(status: string): boolean {
  return status === "paid" || status === "partial";
}

/** Reprints the 58 mm receipt of an existing payment with the signed-in user's access. */
export async function printPaymentReceipt(p: ReceiptPayment, studentName: string) {
  const [brand, extras, cashier] = await Promise.all([
    getMyCenterProfile().catch(() => null),
    loadReceiptExtras(p.student_id, p.course_id).catch(() => null),
    p.cashier_id
      ? supabase.from("profiles").select("full_name").eq("id", p.cashier_id).maybeSingle().then((r) => r.data?.full_name ?? null)
      : Promise.resolve(null),
  ]);
  await printReceipt58({
    centerName: brand?.name || "Akhmad Academy",
    centerPhone: brand?.phone ?? null,
    centerSite: centerSiteFromLocation(brand?.custom_domain ?? null),
    logoUrl: brand && !brand.is_flagship && brand.logo_url ? brand.logo_url : `${window.location.origin}/receipt-logo.png`,
    parentPhone: extras?.parentPhone ?? null,
    teacherName: extras?.teacherName ?? null,
    debtLeft: extras?.debtLeft ?? null,
    nextDue: receiptNextDue(p.period_month),
    receiptNo: p.id.slice(0, 8).toUpperCase(),
    date: new Date(p.paid_at ?? p.created_at),
    studentName,
    courseName: p.course_name,
    periodMonth: p.period_month,
    subtotal: Number(p.subtotal || p.total_amount || p.amount),
    discount: Number(p.discount_amount || 0),
    method: p.payment_method ?? "cash",
    cashierName: cashier,
  });
}
