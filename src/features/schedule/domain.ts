import type { LessonSlot, ScheduleConflict } from "@/features/schedule/types";

/** Times from HTML inputs may omit seconds; normalize before comparing them. */
export function normalizedTime(time: string) {
  return time.length === 5 ? `${time}:00` : time;
}

/** Endpoints touching exactly (19:00–20:00 after 18:00–19:00) do not conflict. */
export function timeRangesOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string,
) {
  return (
    normalizedTime(leftStart) < normalizedTime(rightEnd) &&
    normalizedTime(rightStart) < normalizedTime(leftEnd)
  );
}

export function findLessonConflicts(
  candidate: Omit<LessonSlot, "id">,
  existing: LessonSlot[],
  excludeLessonId?: string,
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  for (const lesson of existing) {
    if (lesson.id === excludeLessonId || lesson.day_of_week !== candidate.day_of_week) continue;
    if (
      !timeRangesOverlap(
        candidate.start_time,
        candidate.end_time,
        lesson.start_time,
        lesson.end_time,
      )
    )
      continue;
    if (lesson.group_id === candidate.group_id)
      conflicts.push({ kind: "group", lessonId: lesson.id });
    if (candidate.teacher_user_id && lesson.teacher_user_id === candidate.teacher_user_id) {
      conflicts.push({ kind: "teacher", lessonId: lesson.id });
    }
    if (candidate.room_id && lesson.room_id === candidate.room_id) {
      conflicts.push({ kind: "room", lessonId: lesson.id });
    }
  }
  return conflicts;
}

export function scheduleConflictMessage(error: { code?: string | null; message?: string | null }) {
  if (error.code === "23P01") return error.message ?? "Bu vaqt oralig'ida jadval konflikti bor.";
  return error.message ?? "Dars jadvalini saqlab bo'lmadi.";
}
