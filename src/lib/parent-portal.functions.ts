import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeParentPhone, parentCodeHash, PARENT_CODE_LIMITS } from "@/lib/parent-portal";

const GENERIC_SENT =
  "Agar bu raqam ro'yxatda bo'lsa va Telegram botga ulangan bo'lsa, kod Telegramga yuborildi.";

function randomCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0]! % 1_000_000).padStart(6, "0");
}

function randomPassword(): string {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("") + "Aa1!";
}

async function childrenForPhone(admin: any, phone: string) {
  const { data, error } = await admin.rpc("telegram_students_by_parent_phone", { p_phone: phone });
  if (error) throw new Error("Ma'lumotlarni o'qib bo'lmadi");
  // The RPC matches by suffix; keep only exact last-9-digit matches.
  return ((data ?? []) as Array<{
    id: string; full_name: string | null; first_name: string | null; last_name: string | null;
    parent_phone: string | null; parent_phones: string[] | null; parent_telegram_chat_id: string | null;
  }>).filter((s) =>
    [s.parent_phone, ...(s.parent_phones ?? [])].some((p) => normalizeParentPhone(p) === phone),
  );
}

/** Public: sends a one-time sign-in code to the Telegram chat linked to this parent phone. */
export const requestParentCode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ phone: z.string().trim().min(7).max(32) }).parse(d))
  .handler(async ({ data }) => {
    const phone = normalizeParentPhone(data.phone);
    if (phone.length !== 9) throw new Error("Telefon raqamni to'liq kiriting");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const since = new Date(Date.now() - PARENT_CODE_LIMITS.windowMinutes * 60_000).toISOString();
    const { count } = await admin
      .from("parent_login_codes")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", since);
    if ((count ?? 0) >= PARENT_CODE_LIMITS.maxCodesPerWindow) {
      throw new Error(`Juda ko'p urinish. ${PARENT_CODE_LIMITS.windowMinutes} daqiqadan keyin qayta urinib ko'ring.`);
    }

    const kids = await childrenForPhone(admin, phone);
    const chats = [...new Set(kids.map((k) => k.parent_telegram_chat_id).filter(Boolean))] as string[];
    if (!chats.length) return { ok: true, message: GENERIC_SENT };

    const code = randomCode();
    const { error } = await admin.from("parent_login_codes").insert({
      phone,
      code_hash: await parentCodeHash(phone, code),
      expires_at: new Date(Date.now() + PARENT_CODE_LIMITS.ttlMinutes * 60_000).toISOString(),
    });
    if (error) throw new Error("Kodni saqlab bo'lmadi");

    const { sendTelegramText } = await import("@/lib/telegram.server");
    await Promise.all(
      chats.map((chat) =>
        sendTelegramText(
          chat,
          `🔐 Akhmad Academy ota-ona ilovasiga kirish kodi: ${code}\n\nKod ${PARENT_CODE_LIMITS.ttlMinutes} daqiqa amal qiladi. Uni hech kimga bermang.`,
        ),
      ),
    );
    return { ok: true, message: GENERIC_SENT };
  });

/** Public: checks the code and returns a one-time token the browser exchanges for a session. */
export const verifyParentCode = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ phone: z.string().trim().min(7).max(32), code: z.string().trim().regex(/^\d{6}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const phone = normalizeParentPhone(data.phone);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: row } = await admin
      .from("parent_login_codes")
      .select("id, code_hash, attempts, expires_at")
      .eq("phone", phone)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row) throw new Error("Kod eskirgan yoki topilmadi. Yangi kod oling.");
    if (row.attempts >= PARENT_CODE_LIMITS.maxAttempts) throw new Error("Urinishlar tugadi. Yangi kod oling.");
    if ((await parentCodeHash(phone, data.code)) !== row.code_hash) {
      await admin.from("parent_login_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      throw new Error("Kod noto'g'ri");
    }
    await admin.from("parent_login_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);

    const kids = await childrenForPhone(admin, phone);
    if (!kids.length) throw new Error("Bu raqamga bog'langan o'quvchi topilmadi");

    const email = `parent.${phone}@parents.akhmadacademy.local`;
    const { data: account } = await admin.from("parent_accounts").select("user_id").eq("phone", phone).maybeSingle();
    let userId: string | null = account?.user_id ?? null;
    if (!userId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: { full_name: "Ota-ona", phone: `+998${phone}` },
      });
      if (createErr || !created?.user) throw new Error("Hisob yaratib bo'lmadi");
      userId = created.user.id as string;
      await admin.from("parent_accounts").insert({ user_id: userId, phone });
    }
    await admin.from("user_roles").upsert({ user_id: userId, role: "parent" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    await admin.from("parent_accounts").update({ last_login_at: new Date().toISOString() }).eq("user_id", userId);

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const tokenHash = link?.properties?.hashed_token as string | undefined;
    if (linkErr || !tokenHash) throw new Error("Kirish tokenini yaratib bo'lmadi");
    return { tokenHash };
  });

export type ParentChild = {
  id: string;
  name: string;
  status: string | null;
  groups: { name: string; subject: string | null; teacher: string | null; days: number[]; start: string | null; end: string | null; fee: number }[];
  attendance: { date: string; status: string }[];
  payments: { id: string; period: string; total: number; paid: number; status: string; paidAt: string | null }[];
  grades: { date: string; score: number; max: number | null; kind: string | null; subject: string | null; comment: string | null }[];
  debt: number;
};

/** Signed-in parent: only the children whose parent phone equals the verified phone. */
export const getParentOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ phone: string; center: string; children: ParentChild[] }> => {
    const { data: acc } = await (context.supabase as any)
      .from("parent_accounts")
      .select("phone")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!acc?.phone) throw new Error("Bu hisob ota-ona hisobi emas");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const kids = await childrenForPhone(admin, acc.phone);
    const ids = kids.map((k) => k.id);
    if (!ids.length) return { phone: acc.phone, center: "Akhmad Academy", children: [] };

    const [st, enr, att, pay, gr] = await Promise.all([
      admin.from("students").select("id, full_name, first_name, last_name, status_enum, center_id").in("id", ids),
      admin
        .from("student_enrollments")
        .select("student_id, monthly_fee, status, group:groups(name, teacher_id, schedule_days, schedule_start, schedule_end, monthly_fee, subject:subjects(name))")
        .in("student_id", ids)
        .in("status", ["active", "trial"]),
      admin.from("attendance").select("student_id, date, status").in("student_id", ids).order("date", { ascending: false }).limit(60 * ids.length),
      admin
        .from("payments")
        .select("id, student_id, period_month, total_amount, amount, paid_amount, status, paid_at")
        .in("student_id", ids)
        .neq("status", "voided")
        .order("period_month", { ascending: false })
        .limit(12 * ids.length),
      admin
        .from("grades")
        .select("student_id, graded_at, score, max_score, kind, comment, subject:subjects(name)")
        .in("student_id", ids)
        .order("graded_at", { ascending: false })
        .limit(20 * ids.length),
    ]);

    const teacherIds = [...new Set((enr.data ?? []).map((e: any) => e.group?.teacher_id).filter(Boolean))];
    const { data: teachers } = teacherIds.length
      ? await admin.from("profiles").select("id, full_name").in("id", teacherIds)
      : { data: [] };
    const tName = new Map((teachers ?? []).map((t: any) => [t.id, t.full_name]));
    const centerId = (st.data ?? [])[0]?.center_id ?? null;
    const { data: center } = centerId
      ? await admin.from("centers").select("name").eq("id", centerId).maybeSingle()
      : { data: null };

    const children: ParentChild[] = (st.data ?? []).map((s: any) => {
      const payments: ParentChild["payments"] = (pay.data ?? [])
        .filter((p: any) => p.student_id === s.id)
        .map((p: any) => ({
          id: p.id,
          period: String(p.period_month).slice(0, 7),
          total: Number(p.total_amount || p.amount || 0),
          paid: p.status === "paid" ? Number(p.total_amount || p.amount || 0) : Number(p.paid_amount || 0),
          status: p.status,
          paidAt: p.paid_at,
        }));
      return {
        id: s.id,
        name: s.full_name || [s.last_name, s.first_name].filter(Boolean).join(" ") || "O'quvchi",
        status: s.status_enum,
        groups: (enr.data ?? [])
          .filter((e: any) => e.student_id === s.id && e.group)
          .map((e: any) => ({
            name: e.group.name,
            subject: e.group.subject?.name ?? null,
            teacher: (tName.get(e.group.teacher_id) as string | undefined) ?? null,
            days: e.group.schedule_days ?? [],
            start: e.group.schedule_start,
            end: e.group.schedule_end,
            fee: Number(e.monthly_fee ?? e.group.monthly_fee ?? 0),
          })),
        attendance: (att.data ?? []).filter((a: any) => a.student_id === s.id).slice(0, 60).map((a: any) => ({ date: a.date, status: a.status })),
        payments,
        grades: (gr.data ?? [])
          .filter((g: any) => g.student_id === s.id)
          .slice(0, 20)
          .map((g: any) => ({
            date: g.graded_at,
            score: Number(g.score),
            max: g.max_score === null ? null : Number(g.max_score),
            kind: g.kind,
            subject: g.subject?.name ?? null,
            comment: g.comment,
          })),
        debt: payments
          .filter((p: ParentChild["payments"][number]) => ["pending", "partial", "overdue"].includes(p.status))
          .reduce((sum: number, p: ParentChild["payments"][number]) => sum + Math.max(0, p.total - p.paid), 0),
      };
    });
    return { phone: acc.phone, center: center?.name ?? "Akhmad Academy", children };
  });
