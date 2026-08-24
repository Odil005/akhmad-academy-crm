import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SetupStep = {
  key: string;
  title: string;
  hint: string;
  done: boolean;
  count: number;
  to: string;
  optional?: boolean;
};

export const getSetupStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    if (!roles.includes("director") && !roles.includes("admin")) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const count = async (table: string, filter?: (q: any) => any) => {
      let q = supabaseAdmin.from(table as never).select("id", { count: "exact", head: true });
      if (filter) q = filter(q);
      const { count: c } = await q;
      return c ?? 0;
    };

    const [
      cashAccounts,
      subjects,
      teachers,
      groups,
      lessons,
      students,
      parentsLinked,
      recipients,
      sip,
    ] = await Promise.all([
      count("cash_accounts"),
      count("subjects"),
      count("user_roles", (q: any) => q.eq("role", "teacher")),
      count("groups"),
      count("lessons"),
      count("students"),
      count("students", (q: any) => q.not("parent_telegram_chat_id", "is", null)),
      count("director_report_recipients", (q: any) => q.eq("is_active", true)),
      count("sip_config", (q: any) => q.eq("is_active", true)),
    ]);

    const { data: cashReg } = await supabaseAdmin
      .from("cash_register_settings")
      .select("enabled, provider_name, cashbox_id")
      .order("created_at")
      .limit(1)
      .maybeSingle();

    const fiscalReady = !!cashReg?.enabled && cashReg.provider_name !== "mock" && !!cashReg.cashbox_id;

    const steps: SetupStep[] = [
      {
        key: "cash_accounts",
        title: "Kassa hisoblari",
        hint: "Naqd / Karta / Bank kassalarini yarating — to'lovlar shu hisoblarga tushadi.",
        done: cashAccounts > 0,
        count: cashAccounts,
        to: "/finance",
      },
      {
        key: "subjects",
        title: "Fanlar",
        hint: "Markazda o'qitiladigan fanlarni kiriting.",
        done: subjects > 0,
        count: subjects,
        to: "/settings/subjects",
      },
      {
        key: "teachers",
        title: "O'qituvchilar",
        hint: "O'qituvchilarni login va kirish kodi bilan yarating.",
        done: teachers > 0,
        count: teachers,
        to: "/students",
      },
      {
        key: "groups",
        title: "Guruhlar",
        hint: "Fan + o'qituvchi + oylik to'lov bilan guruhlar oching.",
        done: groups > 0,
        count: groups,
        to: "/groups",
      },
      {
        key: "lessons",
        title: "Dars jadvali",
        hint: "Har bir guruh uchun dars kunlari va vaqtini belgilang.",
        done: lessons > 0,
        count: lessons,
        to: "/schedule",
      },
      {
        key: "students",
        title: "O'quvchilar",
        hint: "O'quvchilarni qo'lda qo'shing yoki Excel'dan import qiling.",
        done: students > 0,
        count: students,
        to: "/students",
      },
      {
        key: "parents",
        title: "Ota-ona Telegram ulanishi",
        hint: "Ota-onalar botga ulanmaguncha avtomatik xabarlar bormaydi.",
        done: parentsLinked > 0,
        count: parentsLinked,
        to: "/settings/integrations",
      },
      {
        key: "director_report",
        title: "Direktor kunlik hisoboti",
        hint: "Hisobot 21:00 da yuboriladi — qabul qiluvchi Telegram chat_id kerak.",
        done: recipients > 0,
        count: recipients,
        to: "/settings/director-report",
      },
      {
        key: "fiscal",
        title: "Virtual kassa (fiskal chek)",
        hint: "Haqiqiy fiskal chek uchun provayder va kassa ID sozlanishi kerak.",
        done: fiscalReady,
        count: fiscalReady ? 1 : 0,
        to: "/settings/cash-register",
        optional: true,
      },
      {
        key: "sip",
        title: "IP telefoniya (SIP)",
        hint: "Qo'ng'iroqlarni CRM ichidan qilish uchun SIP trunk ulang.",
        done: sip > 0,
        count: sip,
        to: "/settings/telephony",
        optional: true,
      },
    ];

    const required = steps.filter((s) => !s.optional);
    const doneCount = required.filter((s) => s.done).length;
    const percent = Math.round((doneCount / required.length) * 100);

    return { steps, doneCount, requiredCount: required.length, percent };
  });
