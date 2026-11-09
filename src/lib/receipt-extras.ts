import { supabase } from "@/integrations/supabase/client";

/** Reads the extra receipt lines (parent phone, teacher, remaining debt) with the signed-in user's access. */
export async function loadReceiptExtras(studentId: string, groupId: string | null) {
  const [student, group, debts] = await Promise.all([
    supabase.from("students").select("parent_phone").eq("id", studentId).maybeSingle(),
    groupId
      ? supabase.from("groups").select("teacher_id").eq("id", groupId).maybeSingle()
      : Promise.resolve({ data: null as { teacher_id: string | null } | null }),
    supabase
      .from("payments")
      .select("total_amount, amount, paid_amount, status")
      .eq("student_id", studentId)
      .in("status", ["pending", "partial", "overdue"]),
  ]);
  let teacherName: string | null = null;
  const teacherId = group.data?.teacher_id ?? null;
  if (teacherId) {
    const { data } = await supabase.from("profiles").select("full_name").eq("id", teacherId).maybeSingle();
    teacherName = data?.full_name ?? null;
  }
  const debtLeft = (debts.data ?? []).reduce(
    (sum, p) => sum + Math.max(0, Number(p.total_amount ?? p.amount ?? 0) - Number(p.paid_amount ?? 0)),
    0,
  );
  return { parentPhone: student.data?.parent_phone ?? null, teacherName, debtLeft };
}

export function centerSiteFromLocation(customDomain?: string | null): string | null {
  if (customDomain) return customDomain;
  if (typeof window === "undefined") return null;
  const h = window.location.hostname;
  return /localhost|lovable|127\.0\.0\.1/.test(h) ? null : h.replace(/^www\./, "");
}
