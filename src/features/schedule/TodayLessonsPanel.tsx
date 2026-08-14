import { CalendarDays, Clock, MapPin } from "lucide-react";
import { formatTodayLabel, toneFor } from "@/features/schedule/layout";
import type { ScheduleLesson } from "@/features/schedule/types";

type TodayLessonsPanelProps = {
  lessons: ScheduleLesson[];
  today: Date;
  teacherName: (teacherId: string | null) => string;
  onShowAll: () => void;
};

export function TodayLessonsPanel({
  lessons,
  today,
  teacherName,
  onShowAll,
}: TodayLessonsPanelProps) {
  const sorted = [...lessons].sort((left, right) =>
    left.start_time.localeCompare(right.start_time),
  );
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-start justify-between border-b border-border px-4 py-4">
        <div>
          <h2 className="text-base font-extrabold">Bugungi darslar</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatTodayLabel(today)}</p>
        </div>
        <div className="rounded-lg border border-border p-2 text-primary">
          <CalendarDays className="h-4 w-4" />
        </div>
      </div>

      <div className="divide-y divide-border">
        {sorted.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Bugun dars yo'q</p>
        ) : (
          sorted.slice(0, 6).map((lesson) => {
            const tone = toneFor(lesson.subject_id ?? lesson.group_id);
            return (
              <div key={lesson.id} className="flex gap-3 px-4 py-3.5">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">
                    {lesson.group?.name ?? lesson.subject?.name ?? "Dars"}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {lesson.start_time.slice(0, 5)} –{" "}
                    {lesson.end_time.slice(0, 5)}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{teacherName(lesson.teacher_user_id)}</span>
                    {lesson.room?.name && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1">
                        <MapPin className="h-3 w-3" /> {lesson.room.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3">
        <button
          type="button"
          onClick={onShowAll}
          className="w-full rounded-xl border border-border px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/5"
        >
          Barcha darslar →
        </button>
      </div>
    </section>
  );
}
