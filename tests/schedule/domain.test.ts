import { describe, expect, it } from "vitest";
import { findLessonConflicts, timeRangesOverlap } from "../../src/features/schedule/domain";
import type { LessonSlot } from "../../src/features/schedule/types";

const lesson = {
  id: "lesson-1",
  group_id: "group-1",
  room_id: "room-1",
  teacher_user_id: "teacher-1",
  day_of_week: 1,
  start_time: "18:00",
  end_time: "19:00",
};

function candidateOf({ id: _id, ...candidate }: LessonSlot): Omit<LessonSlot, "id"> {
  return candidate;
}

describe("schedule domain", () => {
  it("allows two lessons that meet exactly at an endpoint", () => {
    expect(timeRangesOverlap("18:00", "19:00", "19:00", "20:00")).toBe(false);
  });

  it("reports teacher, room and group conflicts independently", () => {
    const conflicts = findLessonConflicts(
      candidateOf({ ...lesson, start_time: "18:30", end_time: "19:30" }),
      [lesson],
    );
    expect(conflicts.map((conflict) => conflict.kind).sort()).toEqual(["group", "room", "teacher"]);
  });

  it("does not conflict across different weekdays", () => {
    const conflicts = findLessonConflicts(candidateOf({ ...lesson, day_of_week: 2 }), [lesson]);
    expect(conflicts).toEqual([]);
  });

  it("does not reserve a missing room or teacher", () => {
    const conflicts = findLessonConflicts(
      candidateOf({
        ...lesson,
        group_id: "group-2",
        room_id: null,
        teacher_user_id: null,
        start_time: "18:30",
        end_time: "19:30",
      }),
      [lesson],
    );
    expect(conflicts).toEqual([]);
  });

  it("does not report the lesson being edited as its own conflict", () => {
    const conflicts = findLessonConflicts(candidateOf(lesson), [lesson], lesson.id);
    expect(conflicts).toEqual([]);
  });
});
