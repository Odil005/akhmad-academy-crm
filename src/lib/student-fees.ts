import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isStaff } from "./authz";

export const studentFeeSchema = z.object({
  studentId: z.string().uuid(),
  enrollmentId: z.string().uuid().optional(),
  monthlyFee: z.number().finite().positive("Summa noldan katta bo‘lishi kerak"),
});

export async function saveIndividualFee(
  client: SupabaseClient<Database>, userId: string, input: z.infer<typeof studentFeeSchema>,
) {
  const data = studentFeeSchema.parse(input);
  const roles = await client.from("user_roles").select("role").eq("user_id", userId);
  if (roles.error) throw new Error(roles.error.message);
  if (!isStaff((roles.data ?? []).map((r) => r.role))) throw new Error("Faqat administrator yoki direktor o‘zgartira oladi");
  const student = await client.from("students").select("id, center_id").eq("id", data.studentId).single();
  if (student.error || !student.data) throw new Error("O‘quvchi topilmadi");
  if (student.data.center_id) {
    const membership = await client.from("user_centers").select("center_id")
      .eq("user_id", userId).eq("center_id", student.data.center_id).maybeSingle();
    if (membership.error || !membership.data) throw new Error("Bu markaz uchun ruxsat yo‘q");
  }
  // Update only the chosen student's price, never group defaults or payment snapshots.
  const result = data.enrollmentId
    ? await client.from("student_enrollments").update({ monthly_fee: data.monthlyFee })
        .eq("id", data.enrollmentId).eq("student_id", data.studentId).eq("status", "active")
        .select("id, monthly_fee").single()
    : await client.from("students").update({ monthly_fee: data.monthlyFee })
        .eq("id", data.studentId).select("id, monthly_fee").single();
  if (result.error || !result.data) throw new Error(result.error?.message ?? "To‘lov saqlanmadi");
  return { monthlyFee: Number(result.data.monthly_fee) };
}