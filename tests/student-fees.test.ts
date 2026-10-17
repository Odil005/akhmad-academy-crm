import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { saveIndividualFee, studentFeeSchema } from "@/lib/student-fees";

const studentId = "00000000-0000-4000-8000-000000000001";
const enrollmentId = "00000000-0000-4000-8000-000000000002";
function mockClient(role = "admin") {
  const calls: Array<{ table: string; update?: unknown; filters: unknown[][] }> = [];
  const from = vi.fn((table: string) => {
    const call: typeof calls[number] = { table, filters: [] }; calls.push(call);
    const result = table === "user_roles" ? { data: [{ role }], error: null }
      : { data: { id: studentId, center_id: null, monthly_fee: 350000 }, error: null };
    const builder = {
      select: () => builder,
      eq: (...args: unknown[]) => { call.filters.push(args); return builder; },
      update: (data: unknown) => { call.update = data; return builder; },
      single: () => Promise.resolve(result),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    return builder;
  });
  return { client: { from } as unknown as SupabaseClient<Database>, calls };
}

describe("individual monthly tuition", () => {
  it("changes only the selected student's active course fee", async () => {
    const { client, calls } = mockClient();
    await saveIndividualFee(client, "staff", { studentId, enrollmentId, monthlyFee: 350000 });
    expect(calls.filter((c) => c.update)).toEqual([
      { table: "student_enrollments", update: { monthly_fee: 350000 }, filters: [["id", enrollmentId], ["student_id", studentId], ["status", "active"]] },
    ]);
  });
  it("keeps existing invoices and payments untouched", async () => {
    const { client, calls } = mockClient();
    await saveIndividualFee(client, "staff", { studentId, enrollmentId, monthlyFee: 350000 });
    expect(calls.map((c) => c.table)).toEqual(["user_roles", "students", "student_enrollments"]);
  });
  it("supports a student fee before group assignment", async () => {
    const { client, calls } = mockClient();
    await saveIndividualFee(client, "staff", { studentId, monthlyFee: 350000 });
    expect(calls.filter((c) => c.update)).toEqual([
      { table: "students", update: { monthly_fee: 350000 }, filters: [["id", studentId]] },
    ]);
  });
  it.each(["teacher", "student"])("does not let %s change prices", async (role) => {
    const { client, calls } = mockClient(role);
    await expect(saveIndividualFee(client, "user", { studentId, monthlyFee: 350000 })).rejects.toThrow("Faqat administrator");
    expect(calls.some((c) => c.update)).toBe(false);
  });
  it.each([-1, 0, NaN, Infinity])("rejects invalid fee %s", (monthlyFee) => {
    expect(studentFeeSchema.safeParse({ studentId, monthlyFee }).success).toBe(false);
  });
});