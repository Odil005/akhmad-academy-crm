/**
 * Pure payroll math shared by server functions and the payroll UI.
 * KPI = collected / expected (how much of the group's fees actually came in).
 * Salary = percent of collected revenue + bonus − penalty.
 */
export type PayrollInput = {
  teacher_user_id: string;
  teacher_name: string;
  students_count: number;
  expected_total: number;
  collected_total: number;
  percent: number;
  bonus: number;
  penalty: number;
};

export type PayrollRow = PayrollInput & {
  percent_earning: number;
  kpi_score: number;
  salary: number;
  per_student_avg: number;
};

const round = (n: number) => Math.round(n * 100) / 100;

export function computePayrollRow(input: PayrollInput): PayrollRow {
  const collected = Math.max(0, input.collected_total);
  const expected = Math.max(0, input.expected_total);
  const percentEarning = round((collected * Math.max(0, input.percent)) / 100);
  const salary = round(Math.max(0, percentEarning + input.bonus - input.penalty));
  const kpi = expected > 0 ? round(Math.min(100, (collected / expected) * 100)) : 0;
  return {
    ...input,
    percent_earning: percentEarning,
    salary,
    kpi_score: kpi,
    per_student_avg: input.students_count > 0 ? round(expected / input.students_count) : 0,
  };
}

export function payrollTotals(rows: PayrollRow[]) {
  return rows.reduce(
    (acc, row) => ({
      students: acc.students + row.students_count,
      expected: acc.expected + row.expected_total,
      collected: acc.collected + row.collected_total,
      salary: acc.salary + row.salary,
    }),
    { students: 0, expected: 0, collected: 0, salary: 0 },
  );
}
