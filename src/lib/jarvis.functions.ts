import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

// Lightweight context: only the fields the AI actually uses. Fewer/smaller queries = faster response.
async function buildBusinessContext(supabase: any, userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthISO = monthStart.toISOString().slice(0, 10);

  const [
    { count: studentsCount },
    { count: groupsCount },
    { data: debtors },
    { data: monthPayments },
    { data: monthExpenses },
    { data: recentLeads },
  ] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("groups").select("id", { count: "exact", head: true }),
    supabase.from("students").select("first_name, last_name, balance, phone").lt("balance", 0).order("balance", { ascending: true }).limit(10),
    supabase.from("payments").select("amount").eq("status", "paid").gte("paid_at", monthISO).limit(2000),
    supabase.from("expenses").select("amount").gte("paid_at", monthISO).limit(2000),
    supabase.from("leads").select("name, phone, course, status, created_at").order("created_at", { ascending: false }).limit(8),
  ]);

  const totalIncome = (monthPayments ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const totalExpense = (monthExpenses ?? []).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
  const totalDebt = (debtors ?? []).reduce((s: number, d: any) => s + Math.abs(Number(d.balance ?? 0)), 0);

  return {
    date: today,
    counts: { students: studentsCount ?? 0, groups: groupsCount ?? 0, debtors: (debtors ?? []).length },
    finance_this_month: { income: totalIncome, expense: totalExpense, profit: totalIncome - totalExpense, total_debt: totalDebt },
    top_debtors: (debtors ?? []).map((d: any) => ({ name: `${d.first_name} ${d.last_name ?? ""}`.trim(), phone: d.phone, debt: Math.abs(Number(d.balance)) })),
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

// Navigation-only shortcut: skip LLM entirely when user just asks to open a section.
const NAV_WORDS = /^(och|ochib ber|ko'rsat|korsat|ber|menga|kerak|>|→)?\s*[a-zA-Z'oO'\u02BB\u2019\- ]{2,40}\??$/i;
function isPureNavigation(text: string): boolean {
  const t = text.trim();
  if (t.length > 40) return false;
  // No numbers, no question words that need data
  if (/\d/.test(t)) return false;
  if (/(qancha|necha|kim|nima|qanday|foyda|daromad|xarajat|qarz|maslahat|hisobot ber|tahlil)/i.test(t)) return false;
  return NAV_WORDS.test(t);
}

export const jarvisChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { messages: ChatMsg[] })
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Response("LOVABLE_API_KEY yo'q", { status: 500 });

    const lastUser = [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "";

    // Ultra-fast path: pure navigation queries skip the LLM entirely (~0ms vs ~2000ms).
    if (isPureNavigation(lastUser)) {
      return { reply: "Ochilmoqda..." };
    }

    const ctx = await getContextCached(context.supabase, context.userId);

    const system: ChatMsg = {
      role: "system",
      content: `Sen — Akhmad Academy uchun biznes-sherik AI (Jarvis). O'zbek tilida, qisqa va aniq javob ber (2-4 gap). Markdown ishlatma. Raqamlarni so'mda ko'rsat.

HOLAT: ${JSON.stringify(ctx)}`,
    };

    // Only send last 6 turns — long history = slow model. Keep memory light.
    const recent = data.messages.slice(-6);

    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [system, ...recent],
        max_tokens: 400,
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
