import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { extractPhones, parseAmount, parseSchedule, parseStartDate, splitFullName } from "@/lib/import-parse";

async function requireStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.some((r: string) => r === "director" || r === "admin")) {
    throw new Response("Forbidden", { status: 403 });
  }
}

/**
 * Legacy sheet row. Everything except a non-empty full_name is optional so a
 * partially filled row never blocks the rest of the import.
 */
const LegacyRow = z.object({
  full_name: z.string().optional().default(""),
  start_date: z.string().optional().nullable().default(null),
  start_date_raw: z.string().optional().default(""),
  birth_date: z.string().optional().nullable().default(null),
  schedule_raw: z.string().optional().default(""),
  schedule_type: z.string().optional().nullable().default(null),
  subject_name: z.string().optional().nullable().default(null),
  lesson_time: z.string().optional().nullable().default(null),
  parent_full_name: z.string().optional().default(""),
  parent_phones: z.array(z.string()).optional().default([]),
  parent_raw: z.string().optional().default(""),
  monthly_fee: z.union([z.number(), z.string()]).optional().nullable().default(null),
});

const LegacyInput = z.object({
  file_name: z.string().optional().default(""),
  group_id: z.string().uuid(),
  academic_year: z.string().min(4),
  duplicate_strategy: z.enum(["skip", "update", "create"]).default("skip"),
  rows: z.array(LegacyRow).min(1).max(5000),
});

function academicYearStart(academicYear: string): number | undefined {
  const m = academicYear.match(/(\d{4})/);
  return m ? Number(m[1]) : undefined;
}

export const importLegacyStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => LegacyInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);

    const yearStart = academicYearStart(data.academic_year);

    const { data: group, error: groupErr } = await supabase
      .from("groups")
      .select("id, name, monthly_fee")
      .eq("id", data.group_id)
      .maybeSingle();
    if (groupErr || !group) throw new Response("Guruh topilmadi", { status: 400 });

    // Existing students of this group for duplicate detection.
    const { data: existing } = await supabase
      .from("students")
      .select("id, full_name, first_name, last_name, parent_phone, parent_phones")
      .eq("group_id", data.group_id);

    const dupKey = (name: string, phone: string) =>
      `${name.toLowerCase().replace(/\s+/g, " ").trim()}|${phone.replace(/\D/g, "")}`;
    const existingByKey = new Map<string, string>();
    (existing ?? []).forEach((s: any) => {
      const name = s.full_name || `${s.last_name ?? ""} ${s.first_name ?? ""}`;
      const phones: string[] = [
        ...(Array.isArray(s.parent_phones) ? s.parent_phones : []),
        ...(s.parent_phone ? [s.parent_phone] : []),
        "",
      ];
      phones.forEach((p) => existingByKey.set(dupKey(name, p ?? ""), s.id));
    });

    // Create the batch first so every inserted row is undoable.
    const { data: batch, error: batchErr } = await supabase
      .from("import_batches")
      .insert({
        kind: "students",
        file_name: data.file_name || null,
        group_id: data.group_id,
        academic_year: data.academic_year,
        total: data.rows.length,
        created_by: userId,
      })
      .select("id")
      .single();
    if (batchErr || !batch) throw new Response(batchErr?.message ?? "Batch yaratilmadi", { status: 400 });

    const details: { row: number; level: "error" | "warning" | "duplicate"; message: string }[] = [];
    let inserted = 0;
    let updated = 0;
    let duplicates = 0;
    let warnings = 0;

    const toInsert: any[] = [];
    const updates: { id: string; patch: any }[] = [];

    data.rows.forEach((raw, i) => {
      const rowNo = i + 1;
      const full = String(raw.full_name ?? "").replace(/\s+/g, " ").trim();
      if (!full) {
        details.push({ row: rowNo, level: "error", message: "F.I.O bo'sh — qator o'tkazildi" });
        return;
      }
      const { first_name, last_name } = splitFullName(full);

      // Re-normalize server-side so the backend never trusts client formatting.
      const phones =
        raw.parent_phones && raw.parent_phones.length
          ? raw.parent_phones.map((p) => p.trim()).filter(Boolean)
          : extractPhones(raw.parent_raw);
      const startIso = raw.start_date ?? parseStartDate(raw.start_date_raw, yearStart).iso;
      const sched = raw.schedule_raw ? parseSchedule(raw.schedule_raw) : null;
      const fee = typeof raw.monthly_fee === "number" ? raw.monthly_fee : parseAmount(raw.monthly_fee);

      if (!startIso && raw.start_date_raw) {
        warnings++;
        details.push({ row: rowNo, level: "warning", message: `Sana o'qilmadi: ${raw.start_date_raw}` });
      }
      if (!phones.length) {
        warnings++;
        details.push({ row: rowNo, level: "warning", message: "Telefon raqami yo'q" });
      }

      const payload = {
        full_name: full,
        first_name: first_name || null,
        last_name: last_name || null,
        parent_full_name: raw.parent_full_name || null,
        parent_phone: phones[0] ?? null,
        parent_phones: phones,
        start_date: startIso,
        birth_date: raw.birth_date || null,
        schedule_raw: raw.schedule_raw || null,
        schedule_type: raw.schedule_type ?? sched?.schedule_type ?? null,
        lesson_time: raw.lesson_time ?? sched?.lesson_time ?? null,
        monthly_fee: fee ?? group.monthly_fee ?? null,
        academic_year: data.academic_year,
        group_id: data.group_id,
        status: "active",
        status_enum: "active",
      };

      const matchId =
        existingByKey.get(dupKey(full, phones[0] ?? "")) ?? existingByKey.get(dupKey(full, ""));

      if (matchId) {
        duplicates++;
        if (data.duplicate_strategy === "skip") {
          details.push({ row: rowNo, level: "duplicate", message: `${full} — mavjud, o'tkazildi` });
          return;
        }
        if (data.duplicate_strategy === "update") {
          updates.push({ id: matchId, patch: payload });
          details.push({ row: rowNo, level: "duplicate", message: `${full} — yangilandi` });
          return;
        }
        details.push({ row: rowNo, level: "duplicate", message: `${full} — yangi sifatida qo'shildi` });
      }

      toInsert.push({
        ...payload,
        enrolled_at: new Date().toISOString(),
        import_batch_id: batch.id,
      });
    });

    if (toInsert.length) {
      const { data: made, error } = await supabase
        .from("students")
        .insert(toInsert)
        .select("id");
      if (error) {
        details.push({ row: 0, level: "error", message: error.message });
      } else {
        inserted = made?.length ?? 0;
        const startedAt = new Date().toISOString().slice(0, 10);
        const enrollments = (made ?? []).map((s: any) => ({
          student_id: s.id,
          group_id: data.group_id,
          started_at: startedAt,
          status: "active",
        }));
        if (enrollments.length) await supabase.from("student_enrollments").insert(enrollments);
      }
    }

    for (const u of updates) {
      const { error } = await supabase.from("students").update(u.patch).eq("id", u.id);
      if (error) details.push({ row: 0, level: "error", message: error.message });
      else updated++;
    }

    const errorCount = details.filter((d) => d.level === "error").length;
    await supabase
      .from("import_batches")
      .update({
        inserted,
        updated,
        duplicates,
        warnings,
        errors: errorCount,
        details: details.slice(0, 500),
      })
      .eq("id", batch.id);

    return {
      batch_id: batch.id as string,
      total: data.rows.length,
      inserted,
      updated,
      duplicates,
      warnings,
      errors: errorCount,
      details,
    };
  });

export const listImportBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { data } = await supabase
      .from("import_batches")
      .select("id, file_name, academic_year, total, inserted, updated, duplicates, warnings, errors, undone_at, created_at, group_id")
      .order("created_at", { ascending: false })
      .limit(20);
    return { items: data ?? [] };
  });

export const undoImportBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ batch_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);

    const { data: students } = await supabase
      .from("students")
      .select("id")
      .eq("import_batch_id", data.batch_id);
    const ids = (students ?? []).map((s: any) => s.id);

    if (ids.length) {
      await supabase.from("student_enrollments").delete().in("student_id", ids);
      const { error } = await supabase.from("students").delete().in("id", ids);
      if (error) throw new Response(error.message, { status: 400 });
    }

    await supabase
      .from("import_batches")
      .update({ undone_at: new Date().toISOString() })
      .eq("id", data.batch_id);

    return { removed: ids.length };
  });
