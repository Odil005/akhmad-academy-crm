import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { canManageSchedule } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const LessonInputSchema = z.object({
  group_id: z.string().uuid(),
  subject_id: z.string().uuid().nullable(),
  room_id: z.string().uuid().nullable(),
  teacher_user_id: z.string().uuid().nullable(),
  day_of_week: z.number().int().min(1).max(7),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  notes: z.string().max(1000).nullable(),
});

async function currentRoles(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((row: { role: string }) => row.role);
}

/** A schedule mutation belongs to the schedule feature, not the route component. */
export const createLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => LessonInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const roles = await currentRoles(context.supabase, context.userId);
    if (!canManageSchedule(roles)) throw new Response("Forbidden", { status: 403 });
    if (data.end_time <= data.start_time) {
      return {
        ok: false as const,
        error: "Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak.",
      };
    }
    const { data: lesson, error } = await context.supabase
      .from("lessons")
      .insert(data)
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message, code: error.code };
    return { ok: true as const, lessonId: lesson.id };
  });
