import { describe, expect, it } from "vitest";
import {
  isAttendanceOverdue,
  timeToMinutes,
  totalAlertCount,
} from "../../src/features/system-alerts/domain";

describe("system alert domain", () => {
  it("waits twenty minutes after a lesson before raising attendance warning", () => {
    expect(
      isAttendanceOverdue({
        endTime: "15:30",
        currentMinute: timeToMinutes("15:49"),
        hasAttendance: false,
        hasStudents: true,
      }),
    ).toBe(false);
    expect(
      isAttendanceOverdue({
        endTime: "15:30",
        currentMinute: timeToMinutes("15:50"),
        hasAttendance: false,
        hasStudents: true,
      }),
    ).toBe(true);
  });

  it("does not warn when attendance exists or a group has no students", () => {
    expect(
      isAttendanceOverdue({
        endTime: "10:00",
        currentMinute: timeToMinutes("12:00"),
        hasAttendance: true,
        hasStudents: true,
      }),
    ).toBe(false);
    expect(
      isAttendanceOverdue({
        endTime: "10:00",
        currentMinute: timeToMinutes("12:00"),
        hasAttendance: false,
        hasStudents: false,
      }),
    ).toBe(false);
  });

  it("sums affected records for the indicator badge", () => {
    expect(totalAlertCount([{ count: 2 }, { count: 3 }, { count: -5 }])).toBe(5);
  });
});
