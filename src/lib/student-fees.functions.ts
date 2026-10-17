import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { studentFeeSchema, saveIndividualFee } from "@/lib/student-fees";

export const updateStudentMonthlyFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => studentFeeSchema.parse(input))
  .handler(({ data, context }) => saveIndividualFee(context.supabase, context.userId, data));