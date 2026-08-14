import { describe, expect, it } from "vitest";
import {
  formatTodayLabel,
  formatWeekRange,
  layoutOverlappingLessons,
  startOfWeek,
  timeGridBlockPosition,
  timeGridBounds,
  toMinutes,
} from "../../src/features/schedule/layout";
import type { ScheduleLesson } from "../../src/features/schedule/types";

function lesson(id: string, start_time: string, end_time: string): ScheduleLesson {
  return {
    id,
    group_id: `group-${id}`,
    subject_id: null,
    room_id: null,
    teacher_user_id: null,
    day_of_week: 1,
    start_time,
    end_time,
    notes: null,
    group: null,
    subject: null,
    room: null,
  };
}

describe("schedule layout", () => {
  it("uses Monday as the beginning of a weekly timetable", () => {
    const wednesday = new Date(2025, 4, 21, 9, 0);
    const monday = startOfWeek(wednesday);

    expect(monday.getFullYear()).toBe(2025);
    expect(monday.getMonth()).toBe(4);
    expect(monday.getDate()).toBe(19);
    expect(monday.getHours()).toBe(12);
    expect(formatTodayLabel(wednesday)).toBe("21 may, chorshanba");
    expect(formatWeekRange(monday)).toBe("19\u201324 may, 2025");
  });

  it("keeps seconds when placing lessons on the grid", () => {
    expect(toMinutes("09:30:30")).toBe(570.5);
  });

  it("keeps early and late lessons inside the grid", () => {
    expect(timeGridBounds([])).toEqual({ startHour: 8, endHour: 20 });
    expect(timeGridBounds([lesson("early", "04:30", "05:15")])).toEqual({
      startHour: 4,
      endHour: 20,
    });
    expect(timeGridBounds([lesson("late", "22:30", "23:45")])).toEqual({
      startHour: 8,
      endHour: 24,
    });
  });

  it("does not let short, adjacent lessons overlap vertically", () => {
    const first = timeGridBlockPosition(8 * 60, 8 * 60 + 15, 8 * 60, 1);
    const second = timeGridBlockPosition(8 * 60 + 15, 8 * 60 + 30, 8 * 60, 1);

    expect(first.top + first.height).toBeLessThanOrEqual(second.top);
  });

  it("shares lanes only for genuinely overlapping lessons", () => {
    const positioned = layoutOverlappingLessons([
      lesson("late", "10:00", "11:00"),
      lesson("first", "09:00", "10:30"),
      lesson("overlap", "09:30", "10:00"),
    ]);
    const byId = new Map(positioned.map((item) => [item.lesson.id, item]));

    expect(byId.get("first")).toMatchObject({ lane: 0, lanes: 2 });
    expect(byId.get("overlap")).toMatchObject({ lane: 1, lanes: 2 });
    expect(byId.get("late")).toMatchObject({ lane: 1, lanes: 2 });
  });

  it("does not split lessons that meet exactly at an endpoint", () => {
    const positioned = layoutOverlappingLessons([
      lesson("first", "09:00", "10:00"),
      lesson("second", "10:00", "11:00"),
    ]);

    expect(
      positioned.map((item) => ({ id: item.lesson.id, lane: item.lane, lanes: item.lanes })),
    ).toEqual([
      { id: "first", lane: 0, lanes: 1 },
      { id: "second", lane: 0, lanes: 1 },
    ]);
  });
});
