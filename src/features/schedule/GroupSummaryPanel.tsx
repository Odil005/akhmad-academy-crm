import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { toneFor } from "@/features/schedule/layout";
import type { ScheduleGroup, ScheduleLesson, ScheduleRef } from "@/features/schedule/types";

type GroupSummaryPanelProps = {
  groups: ScheduleGroup[];
  subjects: ScheduleRef[];
  lessons?: ScheduleLesson[];
};

export function GroupSummaryPanel({ groups, subjects }: GroupSummaryPanelProps) {
  const subjectName = new Map(subjects.map((subject) => [subject.id, subject.name]));
  const counts = new Map<string, number>();

  for (const group of groups) {
    const subjectId = group.subject_id ?? "none";
    counts.set(subjectId, (counts.get(subjectId) ?? 0) + 1);
  }

  const rows = Array.from(counts.entries())
    .map(([subjectId, count]) => ({
      subjectId,
      count,
      name:
        subjectId === "none" ? "Fan biriktirilmagan" : (subjectName.get(subjectId) ?? "Boshqa fan"),
    }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold">Guruhlar jami</h2>
        <span className="text-2xl font-extrabold">{groups.length}</span>
      </div>
      <div className="mt-3 divide-y divide-border">
        {rows.length === 0 ? (
          <p className="py-5 text-center text-xs text-muted-foreground">Guruh qo'shilmagan</p>
        ) : (
          rows.slice(0, 7).map((row) => {
            const tone = toneFor(row.subjectId);
            return (
              <div key={row.subjectId} className="flex items-center gap-2 py-2 text-sm">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-md text-white ${tone.dot}`}
                >
                  <Users className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                <span className="font-bold">{row.count}</span>
              </div>
            );
          })
        )}
      </div>
      <Link
        to="/groups"
        className="mt-3 block rounded-xl border border-border px-3 py-2 text-center text-xs font-bold text-primary transition hover:bg-primary/5"
      >
        Batafsil ko'rish →
      </Link>
    </section>
  );
}
