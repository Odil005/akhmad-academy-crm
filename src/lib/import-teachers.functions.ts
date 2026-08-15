import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateAccessCode, generateUsername } from "@/lib/credentials";

async function requireStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.some((r: string) => r === "director" || r === "admin")) {
    throw new Response("Forbidden", { status: 403 });
  }
}

const TeacherRow = z.object({
  full_name: z.string().min(1),
  first_name: z.string().optional().default(""),
  last_name: z.string().optional().default(""),
  phone: z.string().optional().nullable().default(null),
  subject_name: z.string().optional().nullable().default(null),
  group_name: z.string().optional().nullable().default(null),
  birth_date: z.string().optional().nullable().default(null),
});

const Input = z.object({
  file_name: z.string().optional().default(""),
  create_logins: z.boolean().optional().default(true),
  create_groups: z.boolean().optional().default(true),
  monthly_fee: z.number().optional().default(0),
  rows: z.array(TeacherRow).min(1).max(1000),
});

export type TeacherImportResult = {
  total: number;
  inserted: number;
  skipped: number;
  groups_created: number;
  errors: number;
  credentials: { full_name: string; username: string; access_code: string }[];
  details: { row: number; level: "error" | "warning" | "ok"; message: string }[];
};

/** Import teachers from an Excel sheet: creates logins, teacher role, subject + group. */
export const importTeachers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }): Promise<TeacherImportResult> => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const details: TeacherImportResult["details"] = [];
    const credentials: TeacherImportResult["credentials"] = [];
    let inserted = 0;
    let skipped = 0;
    let groupsCreated = 0;
    let errors = 0;

    const { data: existingCreds } = await supabaseAdmin.from("teacher_credentials").select("username");
    const takenUsernames = new Set((existingCreds ?? []).map((c: any) => String(c.username)));
    const { data: subjectRows } = await supabaseAdmin.from("subjects").select("id, name");
    const subjectMap = new Map<string, string>(
      (subjectRows ?? []).map((s: any) => [String(s.name).trim().toLowerCase(), s.id as string]),
    );
    const { data: groupRows } = await supabaseAdmin.from("groups").select("id, name");
    const groupMap = new Map<string, string>(
      (groupRows ?? []).map((g: any) => [String(g.name).trim().toLowerCase(), g.id as string]),
    );

    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i]!;
      const rowNo = i + 1;
      const fullName = row.full_name.replace(/\s+/g, " ").trim();

      try {
        // Subject (create when missing)
        let subjectId: string | null = null;
        if (row.subject_name) {
          const key = row.subject_name.trim().toLowerCase();
          subjectId = subjectMap.get(key) ?? null;
          if (!subjectId) {
            const { data: sub } = await supabaseAdmin
              .from("subjects")
              .insert({ name: row.subject_name.trim() })
              .select("id")
              .single();
            if (sub) {
              subjectId = sub.id;
              subjectMap.set(key, sub.id);
            }
          }
        }

        // Teacher login
        let teacherUserId: string | null = null;
        if (data.create_logins) {
          let username = generateUsername(row.first_name || fullName, row.last_name || "", row.phone ?? "");
          let n = 1;
          while (takenUsernames.has(username)) username = `${username}${n++}`;
          const accessCode = generateAccessCode(8);
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: usernameToEmail(username),
            password: accessCode,
            email_confirm: true,
            user_metadata: { full_name: fullName, phone: row.phone ?? "" },
          });
          if (createErr || !created?.user) {
            errors++;
            details.push({ row: rowNo, level: "error", message: `${fullName}: ${createErr?.message ?? "login yaratilmadi"}` });
            continue;
          }
          teacherUserId = created.user.id;
          takenUsernames.add(username);

          await supabaseAdmin.from("profiles").upsert({
            id: teacherUserId,
            full_name: fullName,
            phone: row.phone ?? null,
            birth_date: row.birth_date || null,
          });
          await supabaseAdmin.from("user_roles").delete().eq("user_id", teacherUserId);
          await supabaseAdmin.from("user_roles").insert({ user_id: teacherUserId, role: "teacher" });
          await supabaseAdmin.from("teacher_credentials").insert({
            teacher_user_id: teacherUserId,
            username,
            access_code: "***",
            created_by: userId,
          });
          credentials.push({ full_name: fullName, username, access_code: accessCode });
          inserted++;
        } else {
          skipped++;
        }

        // Group (create when missing, bind teacher + subject)
        if (data.create_groups && row.group_name) {
          const key = row.group_name.trim().toLowerCase();
          const existingGroupId = groupMap.get(key);
          if (existingGroupId) {
            if (teacherUserId) {
              await supabaseAdmin
                .from("groups")
                .update({ teacher_id: teacherUserId, subject_id: subjectId })
                .eq("id", existingGroupId);
            }
          } else {
            const { data: g, error: gErr } = await supabaseAdmin
              .from("groups")
              .insert({
                name: row.group_name.trim(),
                subject_id: subjectId,
                teacher_id: teacherUserId,
                monthly_fee: data.monthly_fee ?? 0,
              })
              .select("id")
              .single();
            if (gErr) {
              details.push({ row: rowNo, level: "warning", message: `Guruh yaratilmadi: ${gErr.message}` });
            } else if (g) {
              groupMap.set(key, g.id);
              groupsCreated++;
            }
          }
        }

        details.push({ row: rowNo, level: "ok", message: `${fullName} qo'shildi` });
      } catch (e) {
        errors++;
        details.push({ row: rowNo, level: "error", message: `${fullName}: ${(e as Error).message}` });
      }
    }

    return {
      total: data.rows.length,
      inserted,
      skipped,
      groups_created: groupsCreated,
      errors,
      credentials,
      details,
    };
  });
