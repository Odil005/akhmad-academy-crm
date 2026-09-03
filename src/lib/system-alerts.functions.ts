import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAttendanceOverdue, totalAlertCount } from "@/features/system-alerts/domain";
import type { SystemAlert, SystemAlertSnapshot } from "@/features/system-alerts/types";

type LessonRow = {
  id: string;
  group_id: string;
  end_time: string;
  group: { name: string } | null;
};

type ParentNotificationRow = {
  id: string;
  student_id: string;
  kind: string;
  status: string;
  error: string | null;
  created_at: string;
  student: {
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
};

type QueueRow = {
  id: string;
  payment_id: string | null;
  attempts: number;
  last_error: string | null;
  status: string;
  created_at: string;
};

function tashkentClock() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: "year" | "month" | "day" | "hour" | "minute") =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const local = new Date(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
  );
  return {
    date: `${value("year")}-${String(value("month")).padStart(2, "0")}-${String(
      value("day"),
    ).padStart(2, "0")}`,
    dayOfWeek: ((local.getDay() + 6) % 7) + 1,
    currentMinute: value("hour") * 60 + value("minute"),
  };
}

function studentName(student: ParentNotificationRow["student"]): string {
  if (!student) return "O'quvchi";
  return (
    student.full_name ||
    [student.last_name, student.first_name].filter(Boolean).join(" ") ||
    "O'quvchi"
  );
}

export const getSystemAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SystemAlertSnapshot> => {
    const { data: roleRows, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error(roleError.message);
    const roles = (roleRows ?? []).map((row) => row.role as string);
    if (!roles.includes("director") && !roles.includes("admin")) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const clock = tashkentClock();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const [lessonResult, parentResult, queueResult] = await Promise.all([
      supabaseAdmin
        .from("lessons")
        .select("id, group_id, end_time, group:groups(name)")
        .eq("is_active", true)
        .eq("day_of_week", clock.dayOfWeek)
        .order("end_time"),
      supabaseAdmin
        .from("parent_notifications")
        .select(
          "id, student_id, kind, status, error, created_at, student:students(full_name, first_name, last_name)",
        )
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("notification_queue")
        .select("id, payment_id, attempts, last_error, status, created_at")
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const firstError = [
      lessonResult.error,
      parentResult.error,
      queueResult.error,
    ].find(Boolean);
    if (firstError) throw new Error(firstError.message);

    const lessons = (lessonResult.data ?? []) as unknown as LessonRow[];
    const endedLessons = lessons.filter((lesson) =>
      isAttendanceOverdue({
        endTime: lesson.end_time,
        currentMinute: clock.currentMinute,
        hasAttendance: false,
        hasStudents: true,
      }),
    );
    const lessonIds = endedLessons.map((lesson) => lesson.id);
    const groupIds = Array.from(new Set(endedLessons.map((lesson) => lesson.group_id)));

    const [attendanceResult, enrollmentResult, legacyStudentResult] = await Promise.all([
      lessonIds.length
        ? supabaseAdmin
            .from("attendance")
            .select("lesson_id")
            .eq("date", clock.date)
            .in("lesson_id", lessonIds)
        : Promise.resolve({ data: [], error: null }),
      groupIds.length
        ? supabaseAdmin
            .from("student_enrollments")
            .select("group_id")
            .in("group_id", groupIds)
            .in("status", ["active", "trial"])
            .is("ended_at", null)
        : Promise.resolve({ data: [], error: null }),
      groupIds.length
        ? supabaseAdmin
            .from("students")
            .select("group_id")
            .in("group_id", groupIds)
            .in("status_enum", ["active", "trial"])
        : Promise.resolve({ data: [], error: null }),
    ]);

    const secondaryError = [
      attendanceResult.error,
      enrollmentResult.error,
      legacyStudentResult.error,
    ].find(Boolean);
    if (secondaryError) throw new Error(secondaryError.message);

    const markedLessonIds = new Set(
      (attendanceResult.data ?? []).map((row) => row.lesson_id).filter(Boolean),
    );
    const groupsWithStudents = new Set<string>();
    for (const row of enrollmentResult.data ?? []) groupsWithStudents.add(row.group_id);
    for (const row of legacyStudentResult.data ?? []) {
      if (row.group_id) groupsWithStudents.add(row.group_id);
    }

    const checkedAt = new Date().toISOString();
    const alerts: SystemAlert[] = endedLessons
      .filter(
        (lesson) => groupsWithStudents.has(lesson.group_id) && !markedLessonIds.has(lesson.id),
      )
      .map((lesson) => ({
        id: `attendance:${lesson.id}:${clock.date}`,
        kind: "attendance" as const,
        severity: "warning" as const,
        title: "Davomat kiritilmagan",
        detail: `${lesson.group?.name ?? "Guruh"} · dars ${lesson.end_time.slice(0, 5)} da tugagan`,
        count: 1,
        actionLabel: "Davomat qilish",
        actionPath: "/attendance",
        createdAt: checkedAt,
      }));

    const latestParentNotifications = new Map<string, ParentNotificationRow>();
    for (const row of (parentResult.data ?? []) as unknown as ParentNotificationRow[]) {
      const key = `${row.student_id}:${row.kind}`;
      if (!latestParentNotifications.has(key)) latestParentNotifications.set(key, row);
    }
    const parentFailures = Array.from(latestParentNotifications.values()).filter((row) =>
      ["failed", "error"].includes(row.status),
    );
    if (parentFailures.length) {
      const latest = parentFailures[0]!;
      alerts.push({
        id: "telegram:failed",
        kind: "telegram",
        severity: "warning",
        title: `Telegram xabari yuborilmadi (${parentFailures.length})`,
        detail: `${studentName(latest.student)}: ${latest.error ?? "Yuborishdagi noma'lum xato"}`,
        count: parentFailures.length,
        actionLabel: "Integratsiyani tekshirish",
        actionPath: "/settings/integrations",
        createdAt: latest.created_at,
      });
    }

    const latestQueueByPayment = new Map<string, QueueRow>();
    for (const row of (queueResult.data ?? []) as unknown as QueueRow[]) {
      const key = row.payment_id ?? row.id;
      if (!latestQueueByPayment.has(key)) latestQueueByPayment.set(key, row);
    }
    const stuckQueue = Array.from(latestQueueByPayment.values()).filter(
      (row) => (row.status === "pending" && row.attempts >= 3) || row.status === "skipped",
    );
    if (stuckQueue.length) {
      const latest = stuckQueue[0]!;
      alerts.push({
        id: "receipt:stuck",
        kind: "receipt",
        severity: "warning",
        title: `To'lov cheki yuborilmagan (${stuckQueue.length})`,
        detail: latest.last_error ?? "Telegram chat ID yoki bot sozlamasini tekshiring",
        count: stuckQueue.length,
        actionLabel: "To'lovlarni ochish",
        actionPath: "/payments",
        createdAt: latest.created_at,
      });
    }


    alerts.sort((left, right) => {
      if (left.severity !== right.severity) return left.severity === "critical" ? -1 : 1;
      return right.createdAt.localeCompare(left.createdAt);
    });

    return {
      alerts,
      totalCount: totalAlertCount(alerts),
      criticalCount: alerts
        .filter((alert) => alert.severity === "critical")
        .reduce((total, alert) => total + alert.count, 0),
      checkedAt,
    };
  });
