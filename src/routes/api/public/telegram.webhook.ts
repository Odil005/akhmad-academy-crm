import { createFileRoute } from "@tanstack/react-router";

// Telegram Bot webhook — parent-facing menu + self-service linking.
//
// Onboarding: parent opens the bot, taps "📱 Telefon raqamni yuborish"
// (request_contact) — the bot matches the phone against students.parent_phone
// and links the chat_id automatically. If the phone doesn't match, the bot
// asks for the child's first and last name and links via (name + phone).
//
// Staff-issued single-use tokens (t.me/<bot>?start=<token>) still work as a
// fallback.
//
// State for multi-step prompts is encoded in a zero-width marker at the top
// of the bot's message + Telegram's `force_reply` — no server-side session.

const ZWJ = "\u200b";
const MENU_TEACHER = "👨‍🏫 O'qituvchiga yozish";
const MENU_ANSWERS = "💬 O'qituvchi javoblari";
const MENU_MEETING = "📅 Uchrashuv so'rash";
const MENU_FEEDBACK = "📝 O'qituvchi fikri";
const MENU_PAYMENT = "💳 To'lov holati";
const MENU_STATS = "📊 Davomat va natijalar";
const MENU_AI = "🤖 AI yordamchi";
const MENU_HOME = "🏠 Bosh menyu";

type Contact = { phone_number: string; first_name?: string; last_name?: string; user_id?: number };
type Msg = {
  chat?: { id: number; first_name?: string; last_name?: string; username?: string };
  from?: { id: number };
  text?: string;
  contact?: Contact;
  reply_to_message?: { text?: string };
};
type Update = {
  message?: Msg;
  edited_message?: Msg;
  callback_query?: {
    id: string;
    from: { id: number };
    message?: { chat: { id: number }; message_id: number };
    data?: string;
  };
};

/** Return the last 9 digits of a phone number (Uzbekistan mobile length). */
function normalizePhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.slice(-9);
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
        if (!expected) return new Response("Webhook secret not configured", { status: 503 });
        const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (provided !== expected) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let update: Update;
        try { update = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

        let token = process.env.TELEGRAM_BOT_TOKEN ?? "";
        if (!token) {
          const { data: setting } = await supabaseAdmin
            .from("settings").select("value").eq("key", "telegram_bot").maybeSingle();
          token = (setting?.value as { token?: string } | null)?.token ?? "";
        }

        const tg = async (method: string, body: unknown) => {
          if (!token) return { ok: false } as { ok: boolean };
          try {
            const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            });
            return (await r.json().catch(() => ({}))) as { ok?: boolean };
          } catch { return { ok: false }; }
        };
        const reply = (chat_id: number, text: string, extra: Record<string, unknown> = {}) =>
          tg("sendMessage", { chat_id, text, ...extra });

        const mainMenu = {
          reply_markup: {
            keyboard: [
              [{ text: MENU_PAYMENT }, { text: MENU_STATS }],
              [{ text: MENU_TEACHER }, { text: MENU_ANSWERS }],
              [{ text: MENU_MEETING }, { text: MENU_FEEDBACK }],
              [{ text: MENU_AI }, { text: MENU_HOME }],
            ],
            resize_keyboard: true,
          },
        };

        const contactPrompt = {
          reply_markup: {
            keyboard: [[{ text: "📱 Telefon raqamni yuborish", request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        };

        const askContact = (chat: number, extra = "") =>
          reply(
            chat,
            `Assalomu alaykum! Akhmad Academy botiga xush kelibsiz.\n\n${extra}Farzandingizga ulanish uchun 2 yo'l bor:\n\n1️⃣ Pastdagi "📱 Telefon raqamni yuborish" tugmasini bosing — sizni avtomatik ulaymiz.\n2️⃣ Yoki bitta xabarda farzandingizning ism, familiyasi va telefon raqamingizni yozing.\nNamuna: Ali Valiyev +998901234567`.trim(),
            contactPrompt,
          );


        const linkedStudents = async (chatId: number) => {
          const { data } = await supabaseAdmin
            .from("students")
            .select("id, first_name, last_name, group_id")
            .eq("parent_telegram_chat_id", String(chatId))
            .eq("parent_notifications_enabled", true);
          return data ?? [];
        };

        /** Link all matching students to this chat_id and greet the parent. */
        const linkAndGreet = async (
          chat: number,
          matches: Array<{ id: string; first_name: string | null; last_name: string | null; parent_telegram_chat_id: string | null }>,
        ) => {
          const targets = matches.filter((s) => !s.parent_telegram_chat_id || s.parent_telegram_chat_id === String(chat));
          if (!targets.length) {
            await reply(chat, "⚠️ Bu ma'lumot bilan boshqa akkaunt biriktirilgan. Iltimos, o'quv markazi ma'muriyatiga murojaat qiling.", mainMenu);
            return;
          }
          for (const s of targets) {
            await supabaseAdmin.from("students").update({
              parent_telegram_chat_id: String(chat),
              parent_notifications_enabled: true,
            }).eq("id", s.id);
          }
          const names = targets.map((s) => `• ${s.first_name ?? ""} ${s.last_name ?? ""}`.trim()).join("\n");
          await reply(
            chat,
            `✅ Muvaffaqiyatli bog'landingiz!\n\nEndi quyidagi farzand(lar) uchun bildirishnomalarni olasiz:\n${names}\n\nHar qanday savol uchun quyidagi menyudan foydalaning.`,
            mainMenu,
          );
        };

        type Cand = {
          id: string;
          first_name: string | null;
          last_name: string | null;
          full_name: string | null;
          parent_phone: string | null;
          parent_phones: string[] | null;
          parent_telegram_chat_id: string | null;
        };

        const candidatePool = async (): Promise<Cand[]> => {
          const { data } = await supabaseAdmin
            .from("students")
            .select("id, first_name, last_name, full_name, parent_phone, parent_phones, parent_telegram_chat_id");
          return (data ?? []) as Cand[];
        };

        const phonesOf = (s: Cand) =>
          [s.parent_phone, ...(s.parent_phones ?? [])].map((p) => normalizePhone(p)).filter(Boolean);

        /**
         * Free-text onboarding: "Ali Valiyev +998901234567" (any order).
         * Matches name tokens against student names and the phone against
         * parent_phone / parent_phones. Returns matched students.
         */
        const matchFromText = async (raw: string, knownPhone = ""): Promise<Cand[]> => {
          const digits = raw.replace(/\D/g, "");
          const phone = digits.length >= 7 ? digits.slice(-9) : knownPhone;
          const tokens = raw
            .replace(/[+\d]/g, " ")
            .toLowerCase()
            .split(/\s+/)
            .map((t) => t.replace(/[^a-zа-яʻʼ'`-]/gi, ""))
            .filter((t) => t.length >= 3);

          const pool = await candidatePool();
          const scored = pool
            .map((s) => {
              const names = [s.first_name, s.last_name, s.full_name]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .split(/\s+/)
                .filter(Boolean);
              let nameHits = 0;
              for (const t of tokens) {
                if (names.some((n) => n === t || n.startsWith(t) || t.startsWith(n))) nameHits += 1;
              }
              const phoneHit = phone ? phonesOf(s).includes(phone) : false;
              return { s, score: nameHits * 2 + (phoneHit ? 3 : 0), nameHits, phoneHit };
            })
            .filter((x) => (x.phoneHit && x.nameHits >= 1) || x.nameHits >= 2 || (x.phoneHit && !tokens.length))
            .sort((a, b) => b.score - a.score);

          if (!scored.length) return [];
          const best = scored[0].score;
          return scored.filter((x) => x.score === best).map((x) => x.s);
        };


        // ---------- callback_query (inline buttons) ----------
        if (update.callback_query) {
          const cq = update.callback_query;
          const chatId = cq.message?.chat.id;
          const data = cq.data ?? "";
          await tg("answerCallbackQuery", { callback_query_id: cq.id });
          if (!chatId) return new Response("ok");

          const students = await linkedStudents(chatId);
          if (!students.length) {
            await askContact(chatId);
            return new Response("ok");
          }

          const [kind, ...rest] = data.split(":");
          if (kind === "pick") {
            const [studentId, action] = rest;
            const student = students.find((s) => s.id === studentId);
            if (!student) { await reply(chatId, "❌ O'quvchi mos kelmadi."); return new Response("ok"); }
            return await handleAction(action, student, chatId);
          }
          if (kind === "tch") {
            const [teacherId, studentId] = rest;
            const marker = `${ZWJ}tch|${teacherId}|${studentId}${ZWJ}`;
            await reply(
              chatId,
              `${marker}\n✍️ O'qituvchiga yubormoqchi bo'lgan xabaringizni shu xabarga JAVOB (reply) qilib yozing.`,
              { reply_markup: { force_reply: true, selective: true } },
            );
            return new Response("ok");
          }
          if (kind === "meet") {
            const [teacherId, studentId] = rest;
            const marker = `${ZWJ}meet|${teacherId}|${studentId}${ZWJ}`;
            await reply(
              chatId,
              `${marker}\n📅 Uchrashuv uchun sanani va sababni yozing (masalan: "Chorshanba 17:00, farzandim haqida gaplashmoqchiman").`,
              { reply_markup: { force_reply: true, selective: true } },
            );
            return new Response("ok");
          }
          return new Response("ok");
        }

        // ---------- message ----------
        const msg = update.message ?? update.edited_message;
        const chatId = msg?.chat?.id;
        const text = (msg?.text ?? "").trim();
        if (!chatId) return new Response("ok");

        // Contact shared via "request_contact" button
        if (msg?.contact) {
          const phone = normalizePhone(msg.contact.phone_number);
          if (!phone || phone.length < 7) {
            await reply(chatId, "Telefon raqam noto'g'ri. Qayta urinib ko'ring.", contactPrompt);
            return new Response("ok");
          }
          const pool = await candidatePool();
          const found = pool.filter((s) => phonesOf(s).includes(phone));

          if (found.length) {
            await linkAndGreet(chatId, found);
            return new Response("ok");
          }
          // Phone didn't match — ask for child's name
          const marker = `${ZWJ}link|${phone}${ZWJ}`;
          await reply(
            chatId,
            `${marker}\n🔎 Bu telefon raqam bo'yicha farzand topilmadi.\n\nIltimos, farzandingizning ISM va FAMILIYASINI shu xabarga JAVOB (reply) qilib yozing.\nNamuna: Ali Valiyev`,
            { reply_markup: { force_reply: true, selective: true } },
          );
          return new Response("ok");
        }

        // Force-reply flows
        const rt = msg?.reply_to_message?.text ?? "";
        const markerMatch = rt.match(/\u200b([^\u200b]+)\u200b/);
        if (markerMatch && text) {
          const parts = markerMatch[1].split("|");
          const action = parts[0];

          // Name-based linking after phone mismatch
          if (action === "link") {
            const phone = parts[1] ?? "";
            const tokens = text.split(/\s+/).filter(Boolean).map((t) => t.toLowerCase());
            if (tokens.length < 1) {
              await reply(chatId, "Iltimos, ism va familiyani yozing.");
              return new Response("ok");
            }
            const { data: candidates } = await supabaseAdmin
              .from("students")
              .select("id, first_name, last_name, parent_phone, parent_telegram_chat_id")
              .not("parent_phone", "is", null);
            const scored = (candidates ?? []).map((s) => {
              const fn = (s.first_name ?? "").toLowerCase();
              const ln = (s.last_name ?? "").toLowerCase();
              const ph = normalizePhone(s.parent_phone);
              let score = 0;
              if (tokens.some((t) => fn && (fn === t || fn.startsWith(t) || t.startsWith(fn)))) score += 2;
              if (tokens.some((t) => ln && (ln === t || ln.startsWith(t) || t.startsWith(ln)))) score += 2;
              if (phone && ph === phone) score += 3;
              return { s, score };
            }).filter((x) => x.score >= 2).sort((a, b) => b.score - a.score);
            if (!scored.length) {
              await reply(chatId, "❌ Bunday farzand topilmadi. Iltimos, o'quv markazi ma'muriyatiga murojaat qiling — ular sizni ro'yxatga qo'shishadi.", mainMenu);
              return new Response("ok");
            }
            await linkAndGreet(chatId, scored.map((x) => x.s));
            return new Response("ok");
          }

          // Teacher message / meeting
          if (action === "tch" || action === "meet") {
            const [, teacherId, studentId] = parts;
            const students = await linkedStudents(chatId);
            const student = students.find((s) => s.id === studentId);
            if (!student) { await reply(chatId, "❌ O'quvchi topilmadi."); return new Response("ok"); }
            const body = action === "meet" ? `📅 Uchrashuv so'rovi: ${text}` : text;
            await supabaseAdmin.from("parent_teacher_messages").insert({
              student_id: studentId,
              teacher_id: teacherId,
              parent_chat_id: String(chatId),
              sender_role: "parent",
              message: body,
              status: "sent",
            });
            await reply(chatId, "✅ Xabaringiz o'qituvchiga yuborildi. Javob kelganda sizga bildirishnoma yuboraman.", mainMenu);
            return new Response("ok");
          }

          // AI free-form question
          if (action === "ai") {
            const studentId = parts[1];
            const students = await linkedStudents(chatId);
            const student = students.find((s) => s.id === studentId) ?? students[0];
            if (!student) { await reply(chatId, "❌ O'quvchi topilmadi.", mainMenu); return new Response("ok"); }
            await handleAI(chatId, student, text);
            return new Response("ok");
          }
        }

        // /start [token] — either self-service prompt or legacy token linking
        const startMatch = /^\/start(?:\s+(\S+))?/i.exec(text);
        if (startMatch) {
          const arg = startMatch[1];
          if (!arg) {
            // Already linked? Show menu directly.
            const existing = await linkedStudents(chatId);
            if (existing.length) {
              await reply(chatId, "Bosh menyu:", mainMenu);
              return new Response("ok");
            }
            await askContact(chatId);
            return new Response("ok");
          }
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(arg);
          if (isUuid || arg.length < 20 || arg.length > 128) {
            await askContact(chatId, "Havola noto'g'ri. ");
            return new Response("ok");
          }
          // New unified link tokens (student / teacher / admin / director)
          const { data: uni } = await supabaseAdmin
            .from("telegram_link_tokens")
            .select("token, kind, student_id, user_id, label, expires_at, used_at")
            .eq("token", arg).maybeSingle();
          if (uni) {
            if (uni.used_at) { await askContact(chatId, "Havoladan foydalanilgan. "); return new Response("ok"); }
            if (new Date(uni.expires_at).getTime() < Date.now()) {
              await askContact(chatId, "Havola muddati tugagan. "); return new Response("ok");
            }
            const consume = () => supabaseAdmin.from("telegram_link_tokens").update({
              used_at: new Date().toISOString(), used_by_chat_id: String(chatId),
            }).eq("token", arg).is("used_at", null);

            if (uni.kind === "student") {
              const { data: st } = await supabaseAdmin
                .from("students").select("id, first_name, last_name, parent_telegram_chat_id")
                .eq("id", uni.student_id!).maybeSingle();
              if (!st) { await reply(chatId, "❌ O'quvchi topilmadi."); return new Response("ok"); }
              if (st.parent_telegram_chat_id && st.parent_telegram_chat_id !== String(chatId)) {
                await reply(chatId, "⚠️ Boshqa akkaunt biriktirilgan. Ma'muriyatga murojaat qiling.");
                return new Response("ok");
              }
              await supabaseAdmin.from("students").update({
                parent_telegram_chat_id: String(chatId),
                parent_notifications_enabled: true,
              }).eq("id", st.id);
              await consume();
              await reply(
                chatId,
                `✅ Bog'landi. Endi ${st.first_name ?? ""} ${st.last_name ?? ""} bo'yicha bildirishnomalarni olasiz.`.replace(/\s+/g, " "),
                mainMenu,
              );
              return new Response("ok");
            }

            // Staff link (teacher / admin / director)
            await supabaseAdmin.from("staff_telegram_links").upsert({
              user_id: uni.user_id!,
              role: uni.kind,
              full_name: uni.label,
              telegram_chat_id: String(chatId),
              notifications_enabled: true,
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });
            if (uni.kind === "director") {
              await supabaseAdmin.from("director_report_recipients").upsert({
                user_id: uni.user_id,
                full_name: uni.label ?? "Direktor",
                telegram_chat_id: String(chatId),
                is_active: true,
              }, { onConflict: "telegram_chat_id" });
            }
            await consume();
            await reply(
              chatId,
              `✅ Telegram ID saqlandi (${uni.kind}). Chat ID: ${chatId}\nEndi tizim xabarnomalarini shu chatga olasiz.`,
            );
            return new Response("ok");
          }

          const { data: linkRow } = await supabaseAdmin
            .from("parent_link_tokens")
            .select("token, student_id, expires_at, used_at")
            .eq("token", arg).maybeSingle();
          if (!linkRow) { await askContact(chatId, "Havola noto'g'ri. "); return new Response("ok"); }
          if (linkRow.used_at) { await askContact(chatId, "Havoladan foydalanilgan. "); return new Response("ok"); }
          if (new Date(linkRow.expires_at).getTime() < Date.now()) {
            await askContact(chatId, "Havola muddati tugagan. "); return new Response("ok");
          }
          const { data: student } = await supabaseAdmin
            .from("students").select("id, first_name, last_name, parent_telegram_chat_id")
            .eq("id", linkRow.student_id).maybeSingle();
          if (!student) { await reply(chatId, "❌ O'quvchi topilmadi."); return new Response("ok"); }
          if (student.parent_telegram_chat_id && student.parent_telegram_chat_id !== String(chatId)) {
            await reply(chatId, "⚠️ Boshqa akkaunt biriktirilgan. Ma'muriyatga murojaat qiling.");
            return new Response("ok");
          }
          await supabaseAdmin.from("students").update({
            parent_telegram_chat_id: String(chatId),
            parent_notifications_enabled: true,
          }).eq("id", student.id);
          await supabaseAdmin.from("parent_link_tokens").update({
            used_at: new Date().toISOString(), used_by_chat_id: String(chatId),
          }).eq("token", arg).is("used_at", null);
          await reply(
            chatId,
            `✅ Bog'landi. Endi ${student.first_name} ${student.last_name ?? ""} bo'yicha bildirishnomalarni olasiz.`,
            mainMenu,
          );
          return new Response("ok");
        }

        // Menu handlers — require linked account
        const students = await linkedStudents(chatId);
        if (!students.length) {
          // Automatic onboarding from free text: name + surname (+ phone)
          if (text && !text.startsWith("/")) {
            const found = await matchFromText(text);
            if (found.length) {
              await linkAndGreet(chatId, found);
              return new Response("ok");
            }
            await askContact(
              chatId,
              "❌ Bu ma'lumot bo'yicha farzand topilmadi. Ism, familiya va telefon raqamni tekshirib qayta yuboring.\n\n",
            );
            return new Response("ok");
          }
          await askContact(chatId);
          return new Response("ok");
        }


        const pickStudent = async (action: string, prompt: string) => {
          if (students.length === 1) return handleAction(action, students[0], chatId);
          await reply(chatId, prompt, {
            reply_markup: {
              inline_keyboard: students.map((s) => [{
                text: `${s.first_name} ${s.last_name ?? ""}`.trim(),
                callback_data: `pick:${s.id}:${action}`,
              }]),
            },
          });
          return new Response("ok");
        };

        if (text === MENU_HOME || text === "/menu" || text === "/help") {
          await reply(chatId, "Bosh menyu:", mainMenu);
          return new Response("ok");
        }
        if (text === MENU_TEACHER) return pickStudent("teacher", "Qaysi farzand uchun?");
        if (text === MENU_ANSWERS) return pickStudent("answers", "Qaysi farzand uchun?");
        if (text === MENU_MEETING) return pickStudent("meeting", "Qaysi farzand uchun?");
        if (text === MENU_FEEDBACK) return pickStudent("feedback", "Qaysi farzand uchun?");
        if (text === MENU_PAYMENT) return pickStudent("payment", "Qaysi farzand uchun?");
        if (text === MENU_STATS) return pickStudent("stats", "Qaysi farzand uchun?");
        if (text === MENU_AI) return pickStudent("ai_prompt", "Qaysi farzand haqida so'ramoqchisiz?");

        // Any other free text — answer with the AI assistant directly.
        if (text && !text.startsWith("/")) {
          if (students.length > 1) {
            return pickStudent("ai_prompt", "Qaysi farzand haqida so'ramoqchisiz?");
          }
          await handleAI(chatId, students[0], text);
          return new Response("ok");
        }

        await reply(chatId, "Menyudan tanlang:", mainMenu);
        return new Response("ok");


        // ---------- actions ----------
        async function handleAction(
          action: string,
          student: { id: string; first_name: string | null; last_name: string | null; group_id: string | null },
          chat: number,
        ) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const fullName = `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim();

          if (action === "ai_prompt") {
            const marker = `${ZWJ}ai|${student.id}${ZWJ}`;
            await reply(
              chat,
              `${marker}\n🤖 ${fullName} haqida savolingizni yozing (masalan: "Qancha to'lov qoldi?" yoki "Bu haftadagi natijalari qanday?"). Shu xabarga JAVOB (reply) qilib yozing.`,
              { reply_markup: { force_reply: true, selective: true } },
            );
            return new Response("ok");
          }

          if (action === "teacher" || action === "meeting") {
            const { data: teachers } = await supabaseAdmin.rpc("teachers_for_student", { _student_id: student.id });
            const list = (teachers ?? []) as { teacher_id: string; subject_name: string | null; group_name: string | null }[];
            if (!list.length) {
              await reply(chat, "O'qituvchi topilmadi.");
              return new Response("ok");
            }
            const ids = Array.from(new Set(list.map((t) => t.teacher_id)));
            const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids);
            const nameOf: Record<string, string> = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name ?? "O'qituvchi"]));
            const prefix = action === "meeting" ? "meet" : "tch";
            await reply(chat, `${fullName} — o'qituvchini tanlang:`, {
              reply_markup: {
                inline_keyboard: list.slice(0, 20).map((t) => [{
                  text: `${nameOf[t.teacher_id] ?? "O'qituvchi"} — ${t.subject_name ?? t.group_name ?? ""}`,
                  callback_data: `${prefix}:${t.teacher_id}:${student.id}`,
                }]),
              },
            });
            return new Response("ok");
          }

          if (action === "answers") {
            const { data: rows } = await supabaseAdmin
              .from("parent_teacher_messages")
              .select("message, sender_role, created_at, teacher_id")
              .eq("student_id", student.id)
              .order("created_at", { ascending: false })
              .limit(10);
            if (!rows || rows.length === 0) {
              await reply(chat, "Hozircha yozishmalar yo'q.");
              return new Response("ok");
            }
            await supabaseAdmin.from("parent_teacher_messages")
              .update({ read_at: new Date().toISOString(), status: "read" })
              .eq("student_id", student.id).eq("sender_role", "teacher").is("read_at", null);
            const lines = rows.reverse().map((m) => {
              const who = m.sender_role === "teacher" ? "👨‍🏫 O'qituvchi" : "👨‍👩‍👧 Siz";
              const t = new Date(m.created_at).toLocaleString("uz-UZ", { hour12: false });
              return `${who} (${t}):\n${m.message}`;
            });
            await reply(chat, `📜 Oxirgi yozishmalar:\n\n${lines.join("\n\n")}`);
            return new Response("ok");
          }

          if (action === "feedback") {
            const { data: rows } = await supabaseAdmin
              .from("behavior_evaluations")
              .select("rating, comment, created_at")
              .eq("student_id", student.id)
              .order("created_at", { ascending: false })
              .limit(5);
            if (!rows || rows.length === 0) {
              await reply(chat, "Hozircha o'qituvchi baholari yo'q.");
              return new Response("ok");
            }
            const labels: Record<string, string> = {
              excellent: "🌟 A'lo", good: "😊 Yaxshi", average: "😐 O'rta", needs_improvement: "⚠️ Yaxshilash kerak",
            };
            const t = rows.reverse().map((r) => {
              const d = new Date(r.created_at).toLocaleDateString("uz-UZ");
              return `${d}: ${labels[r.rating] ?? r.rating}${r.comment ? `\n"${r.comment}"` : ""}`;
            }).join("\n\n");
            await reply(chat, `📝 O'qituvchi fikri (${fullName}):\n\n${t}`);
            return new Response("ok");
          }

          if (action === "payment") {
            const summary = await paymentSummary(student.id, fullName);
            await reply(chat, summary);
            return new Response("ok");
          }

          if (action === "stats") {
            const summary = await statsSummary(student.id, fullName);
            await reply(chat, summary);
            return new Response("ok");
          }

          await reply(chat, "Menyudan tanlang:", mainMenu);
          return new Response("ok");
        }

        async function paymentSummary(studentId: string, fullName: string): Promise<string> {
          const { data: pays } = await supabaseAdmin
            .from("payments")
            .select("amount, period_month, status, paid_at")
            .eq("student_id", studentId)
            .order("period_month", { ascending: false })
            .limit(12);
          if (!pays || pays.length === 0) return "To'lovlar topilmadi.";
          const now = new Date();
          const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
          const totalDebt = pays.filter((p) => p.status !== "paid" && p.period_month <= monthKey)
            .reduce((s, p) => s + Number(p.amount || 0), 0);
          const lastPaid = pays.find((p) => p.status === "paid");
          const nextDue = pays.filter((p) => p.status !== "paid").slice(-1)[0];
          const lines = [
            `💳 To'lov holati — ${fullName}`,
            `Qarzdorlik: ${totalDebt.toLocaleString()} so'm`,
            lastPaid ? `Oxirgi to'lov: ${new Date(lastPaid.paid_at ?? lastPaid.period_month).toLocaleDateString("uz-UZ")}` : "Oxirgi to'lov: —",
            nextDue ? `Keyingi muddat: ${String(nextDue.period_month).slice(0, 7)}` : "Keyingi muddat: —",
            "",
            "So'nggi to'lovlar:",
            ...pays.slice(0, 6).map((p) => `• ${String(p.period_month).slice(0, 7)}: ${Number(p.amount).toLocaleString()} so'm — ${p.status === "paid" ? "✅ to'langan" : "⏳ kutilmoqda"}`),
          ];
          return lines.join("\n");
        }

        async function statsSummary(studentId: string, fullName: string): Promise<string> {
          const from = new Date(); from.setDate(from.getDate() - 30);
          const { data: att } = await supabaseAdmin.from("attendance")
            .select("status").eq("student_id", studentId).gte("date", from.toISOString().slice(0, 10));
          const present = (att ?? []).filter((a) => a.status === "present").length;
          const absent = (att ?? []).filter((a) => a.status === "absent").length;
          const late = (att ?? []).filter((a) => a.status === "late").length;
          const { data: grades } = await supabaseAdmin.from("grades")
            .select("score, max_score, created_at")
            .eq("student_id", studentId).order("created_at", { ascending: false }).limit(5);
          const avg = grades && grades.length
            ? (grades.reduce((s, g) => s + (Number(g.score) / Number(g.max_score || 1)) * 100, 0) / grades.length).toFixed(1)
            : "—";
          const lines = [
            `📊 Statistika — ${fullName} (30 kun)`,
            `Davomat: ✅ ${present} · ❌ ${absent} · ⏰ ${late}`,
            `O'rtacha baho: ${avg}%`,
            "",
            "So'nggi baholar:",
            ...(grades ?? []).map((g) => `• ${new Date(g.created_at).toLocaleDateString("uz-UZ")}: ${g.score}/${g.max_score}`),
          ];
          return lines.join("\n");
        }

        async function handleAI(
          chat: number,
          student: { id: string; first_name: string | null; last_name: string | null; group_id: string | null },
          question: string,
        ) {
          const fullName = `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim();
          const [pay, stat] = await Promise.all([
            paymentSummary(student.id, fullName),
            statsSummary(student.id, fullName),
          ]);
          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            await reply(chat, `${pay}\n\n${stat}`, mainMenu);
            return;
          }
          const systemPrompt = `Siz o'quv markazining ota-onalar uchun yordamchisisiz. Faqat berilgan ma'lumotlarga tayanib, qisqa va aniq javob bering. O'zbek tilida javob bering. Agar ma'lumot yetarli bo'lmasa, "Ma'muriyatga murojaat qiling" deb ayting.\n\nO'quvchi: ${fullName}\n\n${pay}\n\n${stat}`;
          try {
            const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: question },
                ],
              }),
            });
            const j = (await r.json().catch(() => ({}))) as { choices?: Array<{ message?: { content?: string } }> };
            const answer = j.choices?.[0]?.message?.content?.trim();
            if (!answer) {
              await reply(chat, `${pay}\n\n${stat}`, mainMenu);
              return;
            }
            await reply(chat, `🤖 ${answer}`, mainMenu);
          } catch {
            await reply(chat, `${pay}\n\n${stat}`, mainMenu);
          }
        }
      },
    },
  },
});
