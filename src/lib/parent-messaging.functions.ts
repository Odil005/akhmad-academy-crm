import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Teacher/staff: list message threads (grouped by student). */
export const listMessageThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rolesRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (rolesRows ?? []).map((r) => r.role as string);
    const isStaff = roles.includes("director") || roles.includes("admin");
    if (!isStaff && !roles.includes("teacher")) throw new Response("Forbidden", { status: 403 });

    let q = supabase
      .from("parent_teacher_messages")
      .select("id, student_id, teacher_id, sender_role, message, status, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!isStaff) q = q.eq("teacher_id", userId);
    const { data: msgs, error } = await q;
    if (error) throw new Response(error.message, { status: 400 });

    const studentIds = Array.from(new Set((msgs ?? []).map((m) => m.student_id)));
    const teacherIds = Array.from(new Set((msgs ?? []).map((m) => m.teacher_id)));
    const [{ data: students }, { data: profs }] = await Promise.all([
      supabase.from("students").select("id, first_name, last_name").in("id", studentIds),
      supabase.from("profiles").select("id, full_name").in("id", teacherIds),
    ]);
    const sMap = Object.fromEntries((students ?? []).map((s) => [s.id, s]));
    const tMap = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name]));

    // Group per (student_id + teacher_id)
    const threads = new Map<string, {
      key: string; studentId: string; teacherId: string;
      studentName: string; teacherName: string;
      last: typeof msgs[number]; unread: number;
    }>();
    for (const m of msgs ?? []) {
      const key = `${m.student_id}:${m.teacher_id}`;
      const cur = threads.get(key);
      const unreadInc = m.sender_role === "parent" && !m.read_at ? 1 : 0;
      if (!cur) {
        const st = sMap[m.student_id];
        threads.set(key, {
          key,
          studentId: m.student_id,
          teacherId: m.teacher_id,
          studentName: st ? `${st.first_name ?? ""} ${st.last_name ?? ""}`.trim() : "—",
          teacherName: tMap[m.teacher_id] ?? "—",
          last: m,
          unread: unreadInc,
        });
      } else {
        cur.unread += unreadInc;
      }
    }
    return Array.from(threads.values()).sort((a, b) =>
      (b.last?.created_at ?? "").localeCompare(a.last?.created_at ?? ""),
    );
  });

/** Get one thread's full message list. */
export const getMessageThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid(), teacherId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: msgs, error } = await supabase
      .from("parent_teacher_messages")
      .select("id, sender_role, message, created_at, read_at, status")
      .eq("student_id", data.studentId)
      .eq("teacher_id", data.teacherId)
      .order("created_at", { ascending: true });
    if (error) throw new Response(error.message, { status: 400 });
    return msgs ?? [];
  });

/** Teacher/staff reply — also forwards message to parent via Telegram. */
export const replyToParent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      studentId: z.string().uuid(),
      teacherId: z.string().uuid().optional(),
      message: z.string().min(1).max(4000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rolesRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (rolesRows ?? []).map((r) => r.role as string);
    const isStaff = roles.includes("director") || roles.includes("admin");
    const teacherId = data.teacherId ?? userId;
    if (!isStaff && teacherId !== userId) throw new Response("Forbidden", { status: 403 });

    // Insert as authenticated user — RLS enforces teacher-student ownership.
    const { error } = await supabase.from("parent_teacher_messages").insert({
      student_id: data.studentId,
      teacher_id: teacherId,
      sender_role: "teacher",
      message: data.message,
      status: "sent",
    });
    if (error) throw new Response(error.message, { status: 400 });

    // Forward to parent chat if linked (admin bypass — we've already authorized).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("first_name, last_name, parent_telegram_chat_id, parent_notifications_enabled")
      .eq("id", data.studentId).maybeSingle();
    if (student?.parent_notifications_enabled && student.parent_telegram_chat_id) {
      let token = process.env.TELEGRAM_BOT_TOKEN ?? "";
      if (!token) {
        const { data: setting } = await supabaseAdmin
          .from("settings").select("value").eq("key", "telegram_bot").maybeSingle();
        token = (setting?.value as { token?: string } | null)?.token ?? "";
      }
      if (token) {
        const text = `👨‍🏫 O'qituvchidan xabar (${student.first_name} ${student.last_name ?? ""}):\n\n${data.message}\n\nJavob berish uchun bot menyusidan "💬 O'qituvchi javoblari" bo'limini oching.`;
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: student.parent_telegram_chat_id, text }),
        }).catch(() => null);
      }
    }
    return { ok: true as const };
  });

/** Mark a thread as read by the teacher. */
export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid(), teacherId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.teacherId !== userId) {
      // staff also allowed
      const { data: rolesRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const roles = (rolesRows ?? []).map((r) => r.role as string);
      if (!roles.includes("director") && !roles.includes("admin")) throw new Response("Forbidden", { status: 403 });
    }
    const { error } = await supabase.from("parent_teacher_messages")
      .update({ read_at: new Date().toISOString(), status: "read" })
      .eq("student_id", data.studentId)
      .eq("teacher_id", data.teacherId)
      .eq("sender_role", "parent")
      .is("read_at", null);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true as const };
  });
