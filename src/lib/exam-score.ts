export function examPercent(score: number, max: number): number {
  if (!max || max <= 0 || Number.isNaN(score)) return 0;
  return Math.round(Math.min(Math.max(score, 0), max) / max * 100);
}

export function examLevel(percent: number): string {
  if (percent >= 86) return "A'lo";
  if (percent >= 71) return "Yaxshi";
  if (percent >= 56) return "Qoniqarli";
  return "Qoniqarsiz";
}
