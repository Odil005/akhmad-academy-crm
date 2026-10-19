export function scheduleTime(raw: string | null | undefined): string | null {
  const match = raw?.match(/\b([01]?\d|2[0-3])(?:[:.]([0-5]\d))?\s*(?:[-–—]\s*(?:[01]?\d|2[0-3])|$)/);
  return match ? `${match[1]?.padStart(2, '0')}:${match[2] ?? '00'}` : null;
}

export function matchingGroups<T extends { name: string; schedule?: string | null; subject_id: string | null; teacher_id: string | null }>(
  groups: T[], subjectId: string, teacherId: string | null, time: string | null,
) {
  return groups.filter(g => g.subject_id === subjectId && (!teacherId || g.teacher_id === teacherId)
    && (!time || scheduleTime(g.name) === time || scheduleTime(g.schedule) === time));
}