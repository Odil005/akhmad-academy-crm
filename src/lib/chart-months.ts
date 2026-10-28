/** Preserve the browser's existing calendar-month boundaries, including DST. */
export function chartMonths(now: Date) {
  return Array.from({ length: 7 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
}