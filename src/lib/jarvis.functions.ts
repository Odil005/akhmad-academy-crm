import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

async function buildBusinessContext(supabase: any, userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthISO = monthStart.toISOString().slice(0, 10);

  const [
    { data: roleRows },
    { count: studentsCount },
    { count: groupsCount },
    { data: activeStudents },
    { data: recentLeads },
    { data: debtors },
    { data: monthPayments },
    { data: monthExpenses },
    { data: todayLessons },
  ] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("groups").select("id", { count: "exact", head: true }),
    supabase.from("students").select("id, first_name, last_name, balance, phone").order("created_at", { ascending: false }).limit(200),
    supabase.from("leads").select("id, name, phone, course, status, created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("students").select("id, first_name, last_name, balance, phone").lt("balance", 0).order("balance", { ascending: true }).limit(30),
    supabase.from("payments").select("amount, paid_at, status").eq("status", "paid").gte("paid_at", monthISO).limit(1000),
    supabase.from("expenses").select("amount, paid_at, category").gte("paid_at", monthISO).limit(1000),
    supabase.from("groups").select("id, name, teacher_id, subject_id").limit(200),
  ]);

  const roles = (roleRows ?? []).map((r: any) => r.role);
  const totalIncome = (monthPayments ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const totalExpense = (monthExpenses ?? []).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
  const totalDebt = (debtors ?? []).reduce((s: number, d: any) => s + Math.abs(Number(d.balance ?? 0)), 0);

  return {
    date: today,
    roles,
    counts: { students: studentsCount ?? 0, groups: groupsCount ?? 0, debtors: (debtors ?? []).length, leads_new: (recentLeads ?? []).filter((l: any) => l.status === "new").length },
    finance_this_month: { income: totalIncome, expense: totalExpense, profit: totalIncome - totalExpense, total_debt: totalDebt },
    top_debtors: (debtors ?? []).slice(0, 10).map((d: any) => ({ name: `${d.first_name} ${d.last_name ?? ""}`.trim(), phone: d.phone, debt: Math.abs(Number(d.balance)) })),
    recent_leads: (recentLeads ?? []).slice(0, 10),
    students_sample: (activeStudents ?? []).slice(0, 40).map((s: any) => ({ name: `${s.first_name} ${s.last_name ?? ""}`.trim(), balance: s.balance, phone: s.phone })),
  };
}

export const jarvisChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { messages: ChatMsg[] })
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Response("LOVABLE_API_KEY yo'q", { status: 500 });

    const ctx = await buildBusinessContext(context.supabase, context.userId);

    const system: ChatMsg = {
      role: "system",
      content: `Sen — Akhmad Academy o'quv markazi uchun biznes-sherik AI yordamchisi (Jarvis). Sen egaga (direktor/admin) qisqa, aniq va biznes tilida javob berasan. O'zbek tilida javob ber. Raqamlarni so'mda ko'rsatish uchun 1000 lik ajratkichlardan foydalan. Kerak bo'lsa maslahat ber (marketing, moliya, o'quvchilarni ushlab qolish, xarajatlarni optimallashtirish). Foydalanuvchi ovoz orqali gaplashishi mumkin, shuning uchun javoblarni tabiiy, qisqa va tushunarli tuz — markdown ishlatma, ovozda o'qilganda ham yaxshi eshitilsin.

BUGUNGI HOLAT (JSON):
${JSON.stringify(ctx, null, 2)}

Foydalanuvchi savoli asosida yuqoridagi ma'lumotlardan foydalanib javob ber. Ma'lumot yo'q bo'lsa, ochiq ayt.`,
    };

    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [system, ...data.messages],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Response(`AI xatolik: ${res.status} ${txt}`, { status: 500 });
    }
    const json = await res.json();
    const reply = json?.choices?.[0]?.message?.content ?? "";
    return { reply };
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
