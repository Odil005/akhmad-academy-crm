import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

// Lightweight context: only the fields the AI actually uses. Fewer/smaller queries = faster response.
async function buildBusinessContext(supabase: any, _userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthISO = monthStart.toISOString().slice(0, 10);

  const [
    { count: studentsCount },
    { count: groupsCount },
    { data: unpaid },
    { data: monthPayments },
    { data: monthExpenses },
    { data: recentLeads },
  ] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("groups").select("id", { count: "exact", head: true }),
    supabase
      .from("payments")
      .select("amount, period_month, student:students(first_name, last_name, full_name, parent_phone)")
      .neq("status", "paid")
      .order("period_month", { ascending: true })
      .limit(15),
    supabase.from("payments").select("amount").eq("status", "paid").gte("paid_at", monthISO).limit(2000),
    supabase.from("expenses").select("amount").gte("paid_at", monthISO).limit(2000),
    supabase.from("leads").select("name, phone, course, status, created_at").order("created_at", { ascending: false }).limit(8),
  ]);

  const totalIncome = (monthPayments ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const totalExpense = (monthExpenses ?? []).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
  const debts = (unpaid ?? []).map((p: any) => ({
    name: p.student?.full_name || `${p.student?.last_name ?? ""} ${p.student?.first_name ?? ""}`.trim() || "—",
    phone: p.student?.parent_phone ?? null,
    debt: Number(p.amount ?? 0),
    period: p.period_month,
  }));
  const totalDebt = debts.reduce((s: number, d: any) => s + d.debt, 0);

  return {
    date: today,
    counts: { students: studentsCount ?? 0, groups: groupsCount ?? 0, debtors: debts.length },
    finance_this_month: { income: totalIncome, expense: totalExpense, profit: totalIncome - totalExpense, total_debt: totalDebt },
    top_debtors: debts,
    recent_leads: recentLeads ?? [],
  };
}

// Simple in-memory cache per worker instance — context re-used within 60s across turns.
const CTX_TTL_MS = 60_000;
const ctxCache = new Map<string, { at: number; ctx: any }>();
async function getContextCached(supabase: any, userId: string) {
  const hit = ctxCache.get(userId);
  const now = Date.now();
  if (hit && now - hit.at < CTX_TTL_MS) return hit.ctx;
  const ctx = await buildBusinessContext(supabase, userId);
  ctxCache.set(userId, { at: now, ctx });
  return ctx;
}


// ---- Tools: Jarvis can read AND act across the whole CRM ----
const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_students",
      description: "O'quvchini ism, familiya yoki telefon bo'yicha qidirish (balans bilan).",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_groups",
      description: "Barcha guruhlar ro'yxati (fan, oylik to'lov, jadval).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_subject",
      description: "Yangi fan yaratish.",
      parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_group",
      description: "Yangi guruh yaratish. subject_name berilsa fan avtomatik topiladi/yaratiladi.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          subject_name: { type: "string" },
          monthly_fee: { type: "number" },
          schedule: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_student",
      description: "Yangi o'quvchi qo'shish.",
      parameters: {
        type: "object",
        properties: {
          first_name: { type: "string" },
          last_name: { type: "string" },
          phone: { type: "string" },
          parent_phone: { type: "string" },
        },
        required: ["first_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_lead",
      description: "Yangi lid (potensial mijoz) qo'shish.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" }, phone: { type: "string" }, course: { type: "string" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_teachers",
      description: "O'qituvchilar ro'yxati (ism, telefon).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_student_to_group",
      description: "O'quvchini guruhga biriktirish (ism va guruh nomi bo'yicha).",
      parameters: {
        type: "object",
        properties: { student_name: { type: "string" }, group_name: { type: "string" } },
        required: ["student_name", "group_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_teacher_to_group",
      description: "O'qituvchini guruhga biriktirish (ism va guruh nomi bo'yicha).",
      parameters: {
        type: "object",
        properties: { teacher_name: { type: "string" }, group_name: { type: "string" } },
        required: ["teacher_name", "group_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_lessons",
      description: "Dars jadvali: kun (1=Dushanba..7), guruh nomi yoki o'qituvchi ismi bo'yicha filtrlash mumkin.",
      parameters: {
        type: "object",
        properties: { day_of_week: { type: "number" }, group_name: { type: "string" }, teacher_name: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_lesson",
      description: "Jadvalga yangi dars qo'shish. day_of_week 1=Dushanba..7=Yakshanba, vaqt 'HH:MM'.",
      parameters: {
        type: "object",
        properties: {
          group_name: { type: "string" },
          day_of_week: { type: "number" },
          start_time: { type: "string" },
          end_time: { type: "string" },
          teacher_name: { type: "string" },
          room_name: { type: "string" },
        },
        required: ["group_name", "day_of_week", "start_time", "end_time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "group_students",
      description: "Guruhdagi o'quvchilar ro'yxati (guruh nomi bo'yicha).",
      parameters: { type: "object", properties: { group_name: { type: "string" } }, required: ["group_name"] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_debtors",
      description: "To'lovi qolgan (qarzdor) o'quvchilar ro'yxati va summasi.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "finance_summary",
      description: "Moliya xulosasi: berilgan oy (YYYY-MM) yoki joriy oy uchun daromad, xarajat, foyda.",
      parameters: { type: "object", properties: { month: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "attendance_summary",
      description: "Davomat xulosasi: oxirgi N kun (default 30) bo'yicha foiz va yo'q kelganlar soni.",
      parameters: { type: "object", properties: { days: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "record_payment",
      description: "O'quvchi uchun to'lov yozish (naqd/karta). amount so'mda.",
      parameters: {
        type: "object",
        properties: { student_name: { type: "string" }, amount: { type: "number" }, method: { type: "string" } },
        required: ["student_name", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_student",
      description: "O'quvchi ma'lumotini o'zgartirish (dars vaqti, ota-ona telefoni, tug'ilgan sana, holat).",
      parameters: {
        type: "object",
        properties: {
          student_name: { type: "string" },
          lesson_time: { type: "string" },
          parent_phone: { type: "string" },
          birth_date: { type: "string" },
          status: { type: "string" },
        },
        required: ["student_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_page",
      description: "CRM'da kerakli bo'limni ochish. path: /dashboard,/students,/groups,/schedule,/attendance,/grades,/rooms,/payments,/finance,/leads,/messages,/reports,/import,/settings,/teacher-panel,/teacher-balance,/calls,/marketplace,/behavior",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    },
  },
] as const;

async function findStudent(supabase: any, name: string) {
  const q = String(name ?? "").trim();
  const { data } = await supabase
    .from("students")
    .select("id, first_name, last_name, full_name, group_id")
    .or(`full_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function runTool(supabase: any, name: string, args: any): Promise<{ result: any; navigate?: string }> {
  switch (name) {
    case "search_students": {
      const q = String(args?.query ?? "").trim();
      const { data } = await supabase
        .from("students")
        .select("id, first_name, last_name, full_name, parent_phone, lesson_time, status, group:groups(name)")
        .or(`full_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,parent_phone.ilike.%${q}%`)
        .limit(10);
      return { result: data ?? [] };
    }
    case "list_lessons": {
      let req = supabase
        .from("lessons")
        .select("day_of_week, start_time, end_time, group:groups(name), subject:subjects(name), room:rooms(name), teacher_user_id")
        .eq("is_active", true)
        .order("day_of_week")
        .order("start_time")
        .limit(200);
      if (args?.day_of_week) req = req.eq("day_of_week", Number(args.day_of_week));
      const { data } = await req;
      return { result: data ?? [] };
    }
    case "create_lesson": {
      const { data: gr } = await supabase.from("groups").select("id, subject_id").ilike("name", `%${args.group_name}%`).limit(1).maybeSingle();
      if (!gr) return { result: { error: `Guruh topilmadi: ${args.group_name}` } };
      let teacher_user_id: string | null = null;
      if (args?.teacher_name) {
        const { data: p } = await supabase.from("profiles").select("id").ilike("full_name", `%${args.teacher_name}%`).limit(1).maybeSingle();
        teacher_user_id = p?.id ?? null;
      }
      let room_id: string | null = null;
      if (args?.room_name) {
        const { data: r } = await supabase.from("rooms").select("id").ilike("name", `%${args.room_name}%`).limit(1).maybeSingle();
        room_id = r?.id ?? null;
      }
      const { error } = await supabase.from("lessons").insert({
        group_id: gr.id,
        subject_id: gr.subject_id ?? null,
        room_id,
        teacher_user_id,
        day_of_week: Number(args.day_of_week),
        start_time: args.start_time,
        end_time: args.end_time,
        is_active: true,
      });
      return { result: error ? { error: error.message } : { ok: true }, navigate: error ? undefined : "/schedule" };
    }
    case "group_students": {
      const { data: gr } = await supabase.from("groups").select("id, name").ilike("name", `%${args.group_name}%`).limit(1).maybeSingle();
      if (!gr) return { result: { error: `Guruh topilmadi: ${args.group_name}` } };
      const { data } = await supabase
        .from("students")
        .select("id, full_name, first_name, last_name, parent_phone, lesson_time")
        .eq("group_id", gr.id)
        .limit(200);
      return { result: { group: gr.name, count: (data ?? []).length, students: data ?? [] } };
    }
    case "list_debtors": {
      const { data } = await supabase
        .from("payments")
        .select("amount, period_month, status, student:students(full_name, first_name, last_name, parent_phone)")
        .neq("status", "paid")
        .order("period_month")
        .limit(50);
      const rows = (data ?? []).map((p: any) => ({
        name: p.student?.full_name || `${p.student?.last_name ?? ""} ${p.student?.first_name ?? ""}`.trim(),
        phone: p.student?.parent_phone ?? null,
        debt: Number(p.amount ?? 0),
        period: p.period_month,
      }));
      return { result: { count: rows.length, total: rows.reduce((s: number, r: any) => s + r.debt, 0), rows } };
    }
    case "finance_summary": {
      const m = String(args?.month ?? "").match(/^\d{4}-\d{2}$/) ? `${args.month}-01` : (() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); })();
      const end = new Date(m); end.setMonth(end.getMonth() + 1);
      const endISO = end.toISOString().slice(0, 10);
      const [{ data: pay }, { data: exp }] = await Promise.all([
        supabase.from("payments").select("amount").eq("status", "paid").gte("paid_at", m).lt("paid_at", endISO).limit(5000),
        supabase.from("expenses").select("amount, category").gte("paid_at", m).lt("paid_at", endISO).limit(5000),
      ]);
      const income = (pay ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
      const expense = (exp ?? []).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
      return { result: { month: m.slice(0, 7), income, expense, profit: income - expense } };
    }
    case "attendance_summary": {
      const days = Math.min(Math.max(Number(args?.days ?? 30), 1), 180);
      const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
      const { data } = await supabase.from("attendance").select("status").gte("date", since).limit(10000);
      const rows = data ?? [];
      const ok = rows.filter((r: any) => r.status === "present" || r.status === "late").length;
      const absent = rows.filter((r: any) => r.status === "absent").length;
      return { result: { days, marks: rows.length, rate_percent: rows.length ? Math.round((ok / rows.length) * 100) : null, absent } };
    }
    case "record_payment": {
      const st = await findStudent(supabase, args.student_name);
      if (!st) return { result: { error: `O'quvchi topilmadi: ${args.student_name}` } };
      const period = (() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); })();
      const amount = Number(args.amount ?? 0);
      const { error } = await supabase.from("payments").insert({
        student_id: st.id,
        amount,
        subtotal: amount,
        total_amount: amount,
        period_month: period,
        status: "paid",
        paid_at: new Date().toISOString(),
        payment_method: args.method === "card" ? "card" : "cash",
      });
      return { result: error ? { error: error.message } : { ok: true, amount }, navigate: error ? undefined : "/payments" };
    }
    case "update_student": {
      const st = await findStudent(supabase, args.student_name);
      if (!st) return { result: { error: `O'quvchi topilmadi: ${args.student_name}` } };
      const patch: Record<string, unknown> = {};
      if (args.lesson_time) patch.lesson_time = args.lesson_time;
      if (args.parent_phone) patch.parent_phone = args.parent_phone;
      if (args.birth_date) patch.birth_date = args.birth_date;
      if (args.status) patch.status = args.status;
      if (!Object.keys(patch).length) return { result: { error: "O'zgartirish uchun maydon berilmadi" } };
      const { error } = await supabase.from("students").update(patch).eq("id", st.id);
      return { result: error ? { error: error.message } : { ok: true, updated: patch }, navigate: error ? undefined : "/students" };
    }

    case "list_groups": {
      const { data } = await supabase
        .from("groups")
        .select("id, name, monthly_fee, schedule, subject:subjects(name)")
        .order("name")
        .limit(50);
      return { result: data ?? [] };
    }
    case "create_subject": {
      const { data, error } = await supabase.from("subjects").insert({ name: args.name }).select("id, name").single();
      return { result: error ? { error: error.message } : data, navigate: error ? undefined : "/settings/subjects" };
    }
    case "create_group": {
      let subject_id: string | null = null;
      if (args?.subject_name) {
        const { data: found } = await supabase.from("subjects").select("id").ilike("name", args.subject_name).maybeSingle();
        if (found) subject_id = found.id;
        else {
          const { data: made } = await supabase.from("subjects").insert({ name: args.subject_name }).select("id").single();
          subject_id = made?.id ?? null;
        }
      }
      const { data, error } = await supabase
        .from("groups")
        .insert({
          name: args.name,
          subject_id,
          monthly_fee: Number(args.monthly_fee ?? 400000),
          schedule: args.schedule ?? null,
        })
        .select("id, name")
        .single();
      return { result: error ? { error: error.message } : data, navigate: error ? undefined : "/groups" };
    }
    case "create_student": {
      const { data, error } = await supabase
        .from("students")
        .insert({
          first_name: args.first_name,
          last_name: args.last_name ?? null,
          full_name: `${args.last_name ?? ""} ${args.first_name ?? ""}`.trim() || args.first_name,
          parent_phone: args.parent_phone ?? args.phone ?? null,
        })

        .select("id, first_name, last_name")
        .single();
      return { result: error ? { error: error.message } : data, navigate: error ? undefined : "/students" };
    }
    case "create_lead": {
      const { data, error } = await supabase
        .from("leads")
        .insert({ name: args.name, phone: args.phone ?? null, course: args.course ?? null })
        .select("id, name")
        .single();
      return { result: error ? { error: error.message } : data, navigate: error ? undefined : "/leads" };
    }
    case "list_teachers": {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (!ids.length) return { result: [] };
      const { data } = await supabase.from("profiles").select("id, full_name, phone").in("id", ids);
      return { result: data ?? [] };
    }
    case "assign_student_to_group": {
      const sName = String(args?.student_name ?? "").trim();
      const gName = String(args?.group_name ?? "").trim();
      const { data: st } = await supabase
        .from("students").select("id, first_name, last_name")
        .or(`first_name.ilike.%${sName}%,last_name.ilike.%${sName}%`).limit(1).maybeSingle();
      if (!st) return { result: { error: `O'quvchi topilmadi: ${sName}` } };
      let { data: gr } = await supabase.from("groups").select("id, name").ilike("name", gName).maybeSingle();
      if (!gr) {
        const { data: made } = await supabase.from("groups").insert({ name: gName, monthly_fee: 0 }).select("id, name").single();
        gr = made ?? null;
      }
      if (!gr) return { result: { error: "Guruh yaratilmadi" } };
      const { error } = await supabase.from("students").update({ group_id: gr.id }).eq("id", st.id);
      if (error) return { result: { error: error.message } };
      await supabase.from("student_enrollments").insert({
        student_id: st.id, group_id: gr.id, status: "active",
        started_at: new Date().toISOString().slice(0, 10),
      });
      return { result: { ok: true, student: `${st.first_name} ${st.last_name ?? ""}`.trim(), group: gr.name }, navigate: "/groups" };
    }
    case "assign_teacher_to_group": {
      const tName = String(args?.teacher_name ?? "").trim();
      const gName = String(args?.group_name ?? "").trim();
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (!ids.length) return { result: { error: "O'qituvchi yo'q" } };
      const { data: prof } = await supabase
        .from("profiles").select("id, full_name").in("id", ids).ilike("full_name", `%${tName}%`).limit(1).maybeSingle();
      if (!prof) return { result: { error: `O'qituvchi topilmadi: ${tName}` } };
      let { data: gr } = await supabase.from("groups").select("id, name").ilike("name", gName).maybeSingle();
      if (!gr) {
        const { data: made } = await supabase
          .from("groups").insert({ name: gName, monthly_fee: 0, teacher_id: prof.id }).select("id, name").single();
        gr = made ?? null;
      } else {
        await supabase.from("groups").update({ teacher_id: prof.id }).eq("id", gr.id);
      }
      return { result: { ok: true, teacher: prof.full_name, group: gr?.name ?? gName }, navigate: "/groups" };
    }
    case "open_page":
      return { result: { opened: args.path }, navigate: String(args.path ?? "") };
    default:
      return { result: { error: "noma'lum tool" } };
  }
}

export const jarvisChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { messages: ChatMsg[] })
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Response("LOVABLE_API_KEY yo'q", { status: 500 });

    // Client already handles obvious navigation intents; here we always answer with the model.


    const ctx = await getContextCached(context.supabase, context.userId);

    const system: ChatMsg = {
      role: "system",
      content: `Sen — Akhmad Academy o'quv markazi CRM'i uchun biznes-sherik AI (Jarvis). O'zbek tilida, qisqa va aniq javob ber. Markdown ishlatma. Raqamlarni so'mda ko'rsat.
Har qanday savolga javob ber: moliya, o'quvchilar, guruhlar, dars jadvali, davomat, to'lovlar, qarzdorlar, lidlar, o'qituvchilar, maslahat va tahlil.
Sen faqat gapirmaysan — CRM ustida amal ham qilasan: guruh/fan/o'quvchi/lid/dars yaratish, to'lov yozish, o'quvchi ma'lumotini o'zgartirish, qidirish va kerakli bo'limni ochish uchun tool'lardan foydalan. Avval kerakli tool'ni chaqir, keyin natija asosida javob ber. Hech qachon "bilmayman" deb ayt — mos tool'ni chaqirib tekshir.
Agar amal foydalanuvchi huquqiga to'g'ri kelmasa (masalan o'qituvchi boshqa guruhni o'zgartirmoqchi), buni muloyim tushuntir.
Ma'lumot yetishmasa faqat bitta qisqa aniqlashtiruvchi savol ber.

HOLAT: ${JSON.stringify(ctx)}`,

    };

    // Only send last 6 turns — long history = slow model. Keep memory light.
    const convo: any[] = [system, ...data.messages.slice(-6)];
    let navigate: string | undefined;

    for (let step = 0; step < 4; step++) {
      const res = await fetch(`${GATEWAY}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          messages: convo,
          tools: TOOLS,
          max_tokens: 600,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Response(`AI xatolik: ${res.status} ${txt}`, { status: 500 });
      }
      const json = await res.json();
      const msg = json?.choices?.[0]?.message;
      const calls = msg?.tool_calls ?? [];

      if (!calls.length) {
        return { reply: msg?.content ?? "", navigate };
      }

      convo.push(msg);
      for (const call of calls) {
        let args: any = {};
        try { args = JSON.parse(call.function?.arguments || "{}"); } catch { /* ignore */ }
        const out = await runTool(context.supabase, call.function?.name, args);
        if (out.navigate) navigate = out.navigate;
        convo.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(out.result).slice(0, 4000) });
      }
      // Data changed — invalidate cached snapshot.
      ctxCache.delete(context.userId);
    }

    return { reply: "Bajarildi.", navigate };
  });


export const jarvisTranscribe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { audio_base64: string; mime: string })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Response("LOVABLE_API_KEY yo'q", { status: 500 });

    const bin = Uint8Array.from(atob(data.audio_base64), (c) => c.charCodeAt(0));
    const ext = data.mime.includes("wav") ? "wav" : data.mime.includes("mp4") ? "mp4" : data.mime.includes("mpeg") ? "mp3" : "webm";
    const blob = new Blob([bin], { type: data.mime });
    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", blob, `rec.${ext}`);

    const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) throw new Response(`STT xato: ${res.status} ${await res.text()}`, { status: 500 });
    const json = await res.json();
    return { text: json.text ?? "" };
  });

export const jarvisSpeak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { text: string })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Response("LOVABLE_API_KEY yo'q", { status: 500 });

    const text = data.text.slice(0, 3000);
    const res = await fetch(`${GATEWAY}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: text,
        voice: "alloy",
        response_format: "mp3",
      }),
    });
    if (!res.ok) throw new Response(`TTS xato: ${res.status} ${await res.text()}`, { status: 500 });
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return { audio_base64: btoa(bin), mime: "audio/mpeg" };
  });
