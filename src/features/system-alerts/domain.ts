export function timeToMinutes(time: string): number {
  const [hours = "0", minutes = "0", seconds = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes) + Number(seconds) / 60;
}

export function isAttendanceOverdue(input: {
  endTime: string;
  currentMinute: number;
  hasAttendance: boolean;
  hasStudents: boolean;
  graceMinutes?: number;
}): boolean {
  const graceMinutes = input.graceMinutes ?? 20;
  if (!input.hasStudents || input.hasAttendance) return false;
  return timeToMinutes(input.endTime) + graceMinutes <= input.currentMinute;
}

export function totalAlertCount(alerts: ReadonlyArray<{ count: number }>): number {
  return alerts.reduce((total, alert) => total + Math.max(0, alert.count), 0);
}
