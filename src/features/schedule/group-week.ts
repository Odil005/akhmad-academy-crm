export const GROUP_WEEK_DAYS = ['Du', 'Se', 'Chor', 'Pay', 'Ju', 'Shan', 'Yak'];

export function groupWeekSchedule(days: number[], start: string, end: string) {
  const unique = [...new Set(days)].sort((a, b) => a - b);
  if (unique.some(day => day < 1 || day > 7 || !Number.isInteger(day))) throw new Error('Hafta kunini to‘g‘ri tanlang');
  if (unique.length && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || end <= start)) {
    throw new Error('Tugash vaqti boshlanish vaqtidan keyin bo‘lishi kerak');
  }
  return {
    schedule_days: unique,
    schedule_start: unique.length ? start : null,
    schedule_end: unique.length ? end : null,
    schedule: unique.length ? `${unique.map(day => GROUP_WEEK_DAYS[day - 1]).join('/')} ${start}–${end}` : null,
  };
}