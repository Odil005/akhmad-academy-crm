/**
 * Qarz undirish (collections) va kassa yopilishi uchun server yordamchilari.
 * Bu fayl faqat serverda ishlaydi — brauzer bundle'iga tushmaydi.
 */

export type DebtorRow = {
  student_id: string;
  student_name: string;
  parent_phone: string | null;
  parent_chat_id: string | null;
  group_name: string | null;
  debt_total: number;
  periods: number;
  oldest_period: string;
  days_overdue: number;
  last_reminder_at: string | null;
  has_plan: boolean;
};

export const money = (value: number) => Number(value || 0).toLocaleString("uz-UZ");

/** Kechikish kunlariga qarab eslatma matni kuchayib boradi. */
export function reminderText(row: {
  student_name: string;
  debt_total: number;
  days_overdue: number;
  periods: number;
}): { text: string; stage: string } {
  const sum = `${money(row.debt_total)} so'm`;
  const months = row.periods > 1 ? ` (${row.periods} oy uchun)` : "";
  if (row.days_overdue <= 0) {
    return {
      stage: "soft",
      text: `Assalomu alaykum! 🌿\n${row.student_name} uchun to'lov muddati yaqinlashdi.\nSumma: ${sum}${months}\n\nQulay bo'lsa, to'lovni oldindan amalga oshirishingiz mumkin. Rahmat!`,
    };
  }
  if (row.days_overdue <= 3) {
    return {
      stage: "due",
      text: `Assalomu alaykum!\n${row.student_name} uchun to'lov muddati o'tdi.\nQarz: ${sum}${months}\nKechikish: ${row.days_overdue} kun\n\nIltimos, imkon topib to'lovni amalga oshiring. Savolingiz bo'lsa shu botga yozing.`,
    };
  }
  if (row.days_overdue <= 7) {
    return {
      stage: "firm",
      text: `Eslatma ⏰\n${row.student_name} uchun to'lov ${row.days_overdue} kun kechikdi.\nQarz: ${sum}${months}\n\nDarslar to'xtamasligi uchun to'lovni bugun-erta amalga oshirishingizni so'raymiz. Bo'lib to'lash imkoniyati ham bor — shu botga yozsangiz, administrator bog'lanadi.`,
    };
  }
  if (row.days_overdue <= 14) {
    return {
      stage: "urgent",
      text: `Muhim ⚠️\n${row.student_name} uchun qarz ${row.days_overdue} kundan beri to'lanmagan.\nQarz: ${sum}${months}\n\nIltimos, bugun administrator bilan bog'laning yoki to'lovni amalga oshiring. Aks holda o'quvchi vaqtincha guruhdan chetlatilishi mumkin.`,
    };
  }
  return {
    stage: "final",
    text: `Oxirgi eslatma ❗️\n${row.student_name} uchun qarz ${row.days_overdue} kun kechikdi.\nQarz: ${sum}${months}\n\nBugun aloqaga chiqmasangiz, o'quvchi guruhdan chetlatiladi. Bo'lib to'lash rejasini tuzishga tayyormiz — shu botga "to'lov rejasi" deb yozing.`,
  };
}

/** Bo'lib to'lash grafigi: teng bo'laklar, oxirgisiga qoldiq qo'shiladi. */
export function buildInstallments(total: number, parts: number, firstDue: string) {
  const safeParts = Math.max(2, Math.min(12, Math.floor(parts)));
  const base = Math.floor(total / safeParts / 1000) * 1000;
  const start = new Date(`${firstDue}T00:00:00Z`);
  return Array.from({ length: safeParts }, (_, index) => {
    const due = new Date(start);
    due.setUTCMonth(due.getUTCMonth() + index);
    const amount = index === safeParts - 1 ? total - base * (safeParts - 1) : base;
    return { position: index + 1, amount, due_date: due.toISOString().slice(0, 10) };
  });
}

export function shiftSummaryText(shift: {
  shift_date: string;
  expected_cash: number;
  expected_card: number;
  expected_online: number;
  counted_cash: number;
  counted_card: number;
  counted_online: number;
  difference: number;
  note?: string | null;
}) {
  const line = (label: string, expected: number, counted: number) =>
    `${label}: kutilgan ${money(expected)} / sanaldi ${money(counted)}`;
  const status =
    shift.difference === 0
      ? "✅ Farq yo'q"
      : shift.difference > 0
        ? `➕ Ortiqcha ${money(shift.difference)} so'm`
        : `➖ Kamomad ${money(Math.abs(shift.difference))} so'm`;
  return [
    `🧾 Kassa yopilishi — ${shift.shift_date}`,
    line("Naqd", shift.expected_cash, shift.counted_cash),
    line("Karta", shift.expected_card, shift.counted_card),
    line("Online", shift.expected_online, shift.counted_online),
    status,
    shift.note ? `Izoh: ${shift.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
