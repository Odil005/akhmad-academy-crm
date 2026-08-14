import type { ScheduleLesson } from "@/features/schedule/types";

export const DAYS_FULL = [
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
  "Yakshanba",
] as const;

export const MONTHS_UZ = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
] as const;

export type LessonTone = {
  card: string;
  title: string;
  muted: string;
  dot: string;
};

const LESSON_TONES: LessonTone[] = [
  {
    card: "border-emerald-300/80 bg-emerald-50/95 dark:border-emerald-700 dark:bg-emerald-950/55",
    title: "text-emerald-800 dark:text-emerald-200",
    muted: "text-emerald-700/80 dark:text-emerald-300/80",
    dot: "bg-emerald-500",
  },
  {
    card: "border-blue-300/80 bg-blue-50/95 dark:border-blue-700 dark:bg-blue-950/55",
    title: "text-blue-800 dark:text-blue-200",
    muted: "text-blue-700/80 dark:text-blue-300/80",
    dot: "bg-blue-600",
  },
  {
    card: "border-violet-300/80 bg-violet-50/95 dark:border-violet-700 dark:bg-violet-950/55",
    title: "text-violet-800 dark:text-violet-200",
    muted: "text-violet-700/80 dark:text-violet-300/80",
    dot: "bg-violet-500",
  },
  {
    card: "border-pink-300/80 bg-pink-50/95 dark:border-pink-700 dark:bg-pink-950/55",
    title: "text-pink-800 dark:text-pink-200",
    muted: "text-pink-700/80 dark:text-pink-300/80",
    dot: "bg-pink-500",
  },
  {
    card: "border-amber-300/80 bg-amber-50/95 dark:border-amber-700 dark:bg-amber-950/55",
    title: "text-amber-800 dark:text-amber-200",
    muted: "text-amber-700/80 dark:text-amber-300/80",
    dot: "bg-amber-500",
  },
];

export function toMinutes(time: string): number {
  const [hours = "0", minutes = "0", seconds = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes) + Number(seconds) / 60;
}

export function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12);
}

export function startOfWeek(date: Date): Date {
  const mondayOffset = (date.getDay() + 6) % 7;
  return addDays(date, -mondayOffset);
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function tashkentNow(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return new Date(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"));
}

export function formatWeekRange(weekStart: Date, lastDayOffset = 5): string {
  const end = addDays(weekStart, lastDayOffset);
  if (weekStart.getFullYear() === end.getFullYear() && weekStart.getMonth() === end.getMonth()) {
    return `${weekStart.getDate()}–${end.getDate()} ${MONTHS_UZ[end.getMonth()]}, ${end.getFullYear()}`;
  }
  if (weekStart.getFullYear() === end.getFullYear()) {
    return `${weekStart.getDate()} ${MONTHS_UZ[weekStart.getMonth()]} – ${end.getDate()} ${MONTHS_UZ[end.getMonth()]}, ${end.getFullYear()}`;
  }
  return `${weekStart.getDate()} ${MONTHS_UZ[weekStart.getMonth()]}, ${weekStart.getFullYear()} – ${end.getDate()} ${MONTHS_UZ[end.getMonth()]}, ${end.getFullYear()}`;
}

export function formatDayLabel(date: Date): string {
  return `${date.getDate()} ${MONTHS_UZ[date.getMonth()]}`;
}

export function formatTodayLabel(date: Date): string {
  const dayIndex = (date.getDay() + 6) % 7;
  return `${date.getDate()} ${MONTHS_UZ[date.getMonth()]}, ${DAYS_FULL[dayIndex].toLowerCase()}`;
}

export function toneFor(key: string | null | undefined): LessonTone {
  const source = key || "default";
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return LESSON_TONES[hash % LESSON_TONES.length]!;
}

/** Keeps all stored lesson times visible, including early and late classes. */
export function timeGridBounds(
  items: ReadonlyArray<Pick<ScheduleLesson, "start_time" | "end_time">>,
): { startHour: number; endHour: number } {
  if (!items.length) return { startHour: 8, endHour: 20 };

  const earliest = Math.min(...items.map((lesson) => toMinutes(lesson.start_time)));
  const latest = Math.max(...items.map((lesson) => toMinutes(lesson.end_time)));
  const startHour = Math.max(0, Math.min(8, Math.floor(earliest / 60)));
  const endHour = Math.min(24, Math.max(20, Math.ceil(latest / 60)));

  return { startHour, endHour: Math.max(startHour + 1, endHour) };
}

/** Adds a small gap without allowing short, adjacent lessons to overlap. */
export function timeGridBlockPosition(
  startMinute: number,
  endMinute: number,
  gridStartMinute: number,
  pixelsPerMinute: number,
): { top: number; height: number } {
  const durationHeight = Math.max(0, endMinute - startMinute) * pixelsPerMinute;
  const verticalGap = Math.min(6, Math.max(1, durationHeight / 4));

  return {
    top: (startMinute - gridStartMinute) * pixelsPerMinute + verticalGap / 2,
    height: Math.max(1, durationHeight - verticalGap),
  };
}

export type LaidOutLesson = {
  lesson: ScheduleLesson;
  lane: number;
  lanes: number;
};

function layoutCluster(cluster: ScheduleLesson[]): LaidOutLesson[] {
  const laneEnds: number[] = [];
  const rows = cluster.map((lesson) => {
    const start = toMinutes(lesson.start_time);
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(toMinutes(lesson.end_time));
    } else {
      laneEnds[lane] = toMinutes(lesson.end_time);
    }
    return { lesson, lane };
  });
  const lanes = Math.max(laneEnds.length, 1);
  return rows.map((row) => ({ ...row, lanes }));
}

export function layoutOverlappingLessons(items: ScheduleLesson[]): LaidOutLesson[] {
  const sorted = [...items].sort(
    (left, right) =>
      toMinutes(left.start_time) - toMinutes(right.start_time) ||
      toMinutes(left.end_time) - toMinutes(right.end_time),
  );
  const result: LaidOutLesson[] = [];
  let cluster: ScheduleLesson[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length) result.push(...layoutCluster(cluster));
    cluster = [];
    clusterEnd = -1;
  };

  for (const lesson of sorted) {
    const start = toMinutes(lesson.start_time);
    if (cluster.length && start >= clusterEnd) flush();
    cluster.push(lesson);
    clusterEnd = Math.max(clusterEnd, toMinutes(lesson.end_time));
  }
  flush();
  return result;
}
