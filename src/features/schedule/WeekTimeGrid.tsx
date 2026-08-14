import { Link } from "@tanstack/react-router";
import { AlertCircle, Clock, GraduationCap, MapPin, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DAYS_FULL,
  addDays,
  dateKey,
  formatDayLabel,
  layoutOverlappingLessons,
  tashkentNow,
  timeGridBlockPosition,
  timeGridBounds,
  toMinutes,
  toneFor,
} from "@/features/schedule/layout";
import type { ScheduleLesson } from "@/features/schedule/types";

type WeekTimeGridProps = {
  days: number[];
  byDay: Record<number, ScheduleLesson[]>;
  weekStart: Date;
  teacherName: (teacherId: string | null) => string;
  isStaff: boolean;
  isAttendancePending: (lesson: ScheduleLesson, occurrence: Date) => boolean;
  onRemove: (lessonId: string) => void;
  onSelectDay: (day: number) => void;
};

const HOUR_HEIGHT = 60;

export function WeekTimeGrid({
  days,
  byDay,
  weekStart,
  teacherName,
  isStaff,
  isAttendancePending,
  onRemove,
  onSelectDay,
}: WeekTimeGridProps) {
  // Avoid a server/client clock mismatch, then keep the current-time marker fresh.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const updateNow = () => setNow(tashkentNow());
    updateNow();
    const timer = window.setInterval(updateNow, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const allLessons = days.flatMap((day) => byDay[day] ?? []);
  const { startHour, endHour } = timeGridBounds(allLessons);
  const gridStart = startHour * 60;
  const gridEnd = endHour * 60;
  const gridHeight = (endHour - startHour) * HOUR_HEIGHT;
  const pixelsPerMinute = HOUR_HEIGHT / 60;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  const gridTemplateColumns = `64px repeat(${days.length}, minmax(${days.length === 1 ? 260 : 132}px, 1fr))`;
  const todayKey = now ? dateKey(now) : null;
  const currentMinute = now ? now.getHours() * 60 + now.getMinutes() : null;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <div style={{ minWidth: days.length === 1 ? 420 : 940 }}>
        <div className="grid border-b border-border" style={{ gridTemplateColumns }}>
          <div className="border-r border-border bg-muted/20" />
          {days.map((day) => {
            const date = addDays(weekStart, day - 1);
            const isToday = dateKey(date) === todayKey;
            return (
              <button
                key={day}
                type="button"
                onClick={() => onSelectDay(day)}
                className={`border-r border-border px-2 py-3 text-center transition last:border-r-0 hover:bg-muted/40 ${
                  isToday ? "bg-primary/[0.06]" : ""
                }`}
              >
                <div className="text-xs font-bold text-foreground md:text-sm">
                  {DAYS_FULL[day - 1]}
                </div>
                <div
                  className={`mt-0.5 text-xs font-semibold ${isToday ? "text-primary" : "text-blue-600"}`}
                >
                  {formatDayLabel(date)}
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid" style={{ gridTemplateColumns }}>
          <div
            className="relative border-r border-border bg-muted/10"
            style={{ height: gridHeight }}
          >
            {hours.map((hour, index) => (
              <span
                key={hour}
                className="absolute right-3 -translate-y-1/2 font-mono text-[11px] text-muted-foreground"
                style={{ top: index * HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, "0")}:00
              </span>
            ))}
          </div>

          {days.map((day) => {
            const occurrence = addDays(weekStart, day - 1);
            const occurrenceKey = dateKey(occurrence);
            const laidOut = layoutOverlappingLessons(byDay[day] ?? []);
            const showNow =
              occurrenceKey === todayKey &&
              currentMinute !== null &&
              currentMinute >= gridStart &&
              currentMinute <= gridEnd;
            return (
              <div
                key={day}
                className="relative border-r border-border last:border-r-0"
                style={{ height: gridHeight }}
              >
                {hours.slice(0, -1).map((hour, index) => (
                  <div
                    key={hour}
                    className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/65"
                    style={{ top: index * HOUR_HEIGHT }}
                  />
                ))}

                {showNow && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500/80"
                    style={{ top: ((currentMinute ?? gridStart) - gridStart) * pixelsPerMinute }}
                  >
                    <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-red-500" />
                  </div>
                )}

                {laidOut.map(({ lesson, lane, lanes }) => {
                  const visibleStart = Math.max(toMinutes(lesson.start_time), gridStart);
                  const visibleEnd = Math.min(toMinutes(lesson.end_time), gridEnd);
                  if (visibleEnd <= gridStart || visibleStart >= gridEnd) return null;
                  const { top, height } = timeGridBlockPosition(
                    visibleStart,
                    visibleEnd,
                    gridStart,
                    pixelsPerMinute,
                  );
                  const laneWidth = 100 / lanes;
                  const tone = toneFor(lesson.subject_id ?? lesson.group_id);
                  const pending = isAttendancePending(lesson, occurrence);
                  const showDetails = height >= 64;
                  return (
                    <article
                      key={lesson.id}
                      className={`group absolute z-10 overflow-hidden rounded-lg border px-2 py-1.5 shadow-sm transition hover:z-30 hover:-translate-y-0.5 hover:shadow-lg ${tone.card}`}
                      style={{
                        top,
                        height,
                        left: `calc(${lane * laneWidth}% + 4px)`,
                        width: `calc(${laneWidth}% - 8px)`,
                      }}
                      title={`${lesson.group?.name ?? "Guruh"} · ${lesson.start_time.slice(0, 5)}–${lesson.end_time.slice(0, 5)}`}
                    >
                      <div
                        className={`truncate pr-4 text-[11px] font-extrabold leading-4 ${tone.title}`}
                      >
                        {lesson.group?.name ?? lesson.subject?.name ?? "Dars"}
                      </div>
                      {showDetails && (
                        <>
                          <div
                            className={`mt-0.5 flex items-center gap-1 truncate text-[10px] ${tone.muted}`}
                          >
                            <GraduationCap className="h-3 w-3 shrink-0" />
                            {teacherName(lesson.teacher_user_id)}
                          </div>
                          {lesson.room?.name && (
                            <div
                              className={`mt-0.5 flex items-center gap-1 truncate text-[10px] ${tone.muted}`}
                            >
                              <MapPin className="h-3 w-3 shrink-0" /> {lesson.room.name}
                            </div>
                          )}
                        </>
                      )}
                      <div
                        className={`mt-0.5 flex items-center gap-1 whitespace-nowrap text-[10px] font-medium ${tone.muted}`}
                      >
                        <Clock className="h-3 w-3 shrink-0" />
                        {lesson.start_time.slice(0, 5)} – {lesson.end_time.slice(0, 5)}
                      </div>
                      {pending &&
                        (height >= 82 ? (
                          <Link
                            to="/attendance"
                            className="mt-1 inline-flex items-center gap-1 rounded-md border border-orange-300 bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold text-orange-700 hover:bg-orange-200"
                          >
                            <AlertCircle className="h-2.5 w-2.5" /> Davomat kutilmoqda
                          </Link>
                        ) : (
                          <Link
                            to="/attendance"
                            aria-label={`Davomat kutilmoqda: ${lesson.group?.name ?? "Guruh"}`}
                            title="Davomat kutilmoqda"
                            className="absolute bottom-1 right-1 rounded bg-orange-100 p-1 text-orange-700 hover:bg-orange-200"
                          >
                            <AlertCircle className="h-3 w-3" />
                          </Link>
                        ))}
                      {isStaff && (
                        <button
                          type="button"
                          onClick={() => onRemove(lesson.id)}
                          className="absolute right-1 top-1 rounded p-0.5 text-destructive opacity-0 transition hover:bg-white/70 group-hover:opacity-80"
                          title="Darsni o'chirish"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
