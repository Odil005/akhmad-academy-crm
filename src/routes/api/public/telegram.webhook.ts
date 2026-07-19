import { createFileRoute } from "@tanstack/react-router";

// Telegram Bot webhook — parent-facing menu + linking flow.
//
// Parents open t.me/<bot>?start=<token> (single-use, short-lived token issued
// by staff) to link their chat_id to a student. After linking, the bot shows
// a reply keyboard with the parent menu (write teacher, see attendance,
// payments, etc). Raw student UUIDs are NOT accepted here.
//
// State is encoded either in inline_keyboard callback_data or in a
// zero-width-marker in the text of a `force_reply` prompt, so no server-side
// session storage is required.

const ZWJ = "\u200b"; // zero-width joiner used as an invisible state marker
const MENU_TEACHER = "👨‍🏫 O'qituvchiga yozish";
const MENU_ANSWERS = "💬 O'qituvchi javoblari";
const MENU_MEETING = "📅 Uchrashuv so'rash";
const MENU_FEEDBACK = "📝 O'qituvchi fikri";
const MENU_PAYMENT = "💳 To'lov holati";
const MENU_STATS = "📊 Davomat va natijalar";
const MENU_HOME = "🏠 Bosh menyu";

type Msg = {
  chat?: { id: number; first_name?: string; last_name?: string; username?: string };
  from?: { id: number };
  text?: string;
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
              [{ text: MENU_TEACHER }, { text: MENU_ANSWERS }],
              [{ text: MENU_MEETING }, { text: MENU_FEEDBACK }],
              [{ text: MENU_PAYMENT }, { text: MENU_STATS }],
              [{ text: MENU_HOME }],
            ],
            resize_keyboard: true,
          },
        };

        // Lookup all students linked to a chat_id
        const linkedStudents = async (chatId: number) => {
          const { data } = await supabaseAdmin
            .from("students")
            .select("id, first_name, last_name, group_id")
            .eq("parent_telegram_chat_id", String(chatId))
            .eq("parent_notifications_enabled", true);
          return data ?? [];
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
            await reply(chatId, "Sizga bog'langan o'quvchi topilmadi. Markazdan yangi havola so'rang.");
            return new Response("ok");
          }

          // pick:<studentId>:<action>
          const [kind, ...rest] = data.split(":");
          if (kind === "pick") {
            const [studentId, action] = rest;
            const student = students.find((s) => s.id === studentId);
            if (!student) { await reply(chatId, "❌ O'quvchi mos kelmadi."); return new Response("ok"); }
            return await handleAction(action, student, chatId);
          }
          if (kind === "tch") {
            // tch:<teacherId>:<studentId>
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
            // meet:<teacherId>:<studentId>
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

        // Force-reply flow: user replied to a marker prompt
        const rt = msg?.reply_to_message?.text ?? "";
        const markerMatch = rt.match(/\u200b([^\u200b]+)\u200b/);
        if (markerMatch && text) {
          const [action, teacherId, studentId] = markerMatch[1].split("|");
          const students = await linkedStudents(chatId);
          const student = students.find((s) => s.id === studentId);
          if (!student) { await reply(chatId, "❌ O'quvchi topilmadi."); return new Response("ok"); }

          if (action === "tch" || action === "meet") {
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
        }

        // /start [token] — parent linking
        const startMatch = /^\/start(?:\s+(\S+))?/i.exec(text);
        if (startMatch) {
          const arg = startMatch[1];
          if (!arg) {
            await reply(chatId, "Assalomu alaykum. Bog'lanish uchun o'quv markazi bergan bir martalik havolani oching.");
            return new Response("ok");
          }
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(arg);
          if (isUuid || arg.length < 20 || arg.length > 128) {
            await reply(chatId, "❌ Havola noto'g'ri yoki eskirgan. Markazdan yangi havola so'rang.");
            return new Response("ok");
          }
          const { data: linkRow } = await supabaseAdmin
            .from("parent_link_tokens")
            .select("token, student_id, expires_at, used_at")
            .eq("token", arg).maybeSingle();
          if (!linkRow) { await reply(chatId, "❌ Havola noto'g'ri."); return new Response("ok"); }
          if (linkRow.used_at) { await reply(chatId, "❌ Bu havoladan foydalanilgan."); return new Response("ok"); }
          if (new Date(linkRow.expires_at).getTime() < Date.now()) {
            await reply(chatId, "❌ Havola muddati tugagan."); return new Response("ok");
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

        // Menu button handlers — user must be linked first
        const students = await linkedStudents(chatId);
        if (!students.length) {
          await reply(chatId, "Siz hali bog'lanmagansiz. Markazdan bir martalik havola so'rang.");
          return new Response("ok");
        }

        // Helper: if multiple children, ask which one
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

          if (action === "teacher" || action === "meeting") {
            const { data: teachers } = await supabaseAdmin.rpc("teachers_for_student", { _student_id: student.id });
            const list = (teachers ?? []) as { teacher_id: string; subject_name: string | null; group_name: string | null }[];
            if (!list.length) {
              await reply(chat, "O'qituvchi topilmadi.");
              return new Response("ok");
            }
            // Enrich with names from profiles
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
            // Mark teacher-sent as read by parent
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
            const text = rows.reverse().map((r) => {
              const d = new Date(r.created_at).toLocaleDateString("uz-UZ");
              return `${d}: ${labels[r.rating] ?? r.rating}${r.comment ? `\n"${r.comment}"` : ""}`;
            }).join("\n\n");
            await reply(chat, `📝 O'qituvchi fikri (${fullName}):\n\n${text}`);
            return new Response("ok");
          }

          if (action === "payment") {
            const { data: pays } = await supabaseAdmin
              .from("payments")
              .select("amount, period_month, status, paid_at")
              .eq("student_id", student.id)
              .order("period_month", { ascending: false })
              .limit(6);
            if (!pays || pays.length === 0) {
              await reply(chat, "To'lovlar topilmadi.");
              return new Response("ok");
            }
            const now = new Date();
            const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
            const totalDebt = pays.filter((p) => p.status !== "paid" && p.period_month <= monthKey)
              .reduce((s, p) => s + Number(p.amount || 0), 0);
            const lastPaid = pays.find((p) => p.status === "paid");
            const nextDue = pays.find((p) => p.status !== "paid");
            const lines = [
              `💳 To'lov holati — ${fullName}`,
              `Qarzdorlik: ${totalDebt.toLocaleString()} so'm`,
              lastPaid ? `Oxirgi to'lov: ${new Date(lastPaid.paid_at ?? lastPaid.period_month).toLocaleDateString("uz-UZ")}` : "Oxirgi to'lov: —",
              nextDue ? `Keyingi muddat: ${String(nextDue.period_month).slice(0, 7)}` : "Keyingi muddat: —",
              "",
              "So'nggi to'lovlar:",
              ...pays.map((p) => `• ${String(p.period_month).slice(0, 7)}: ${Number(p.amount).toLocaleString()} so'm — ${p.status === "paid" ? "✅ to'langan" : "⏳ kutilmoqda"}`),
            ];
            await reply(chat, lines.join("\n"));
            return new Response("ok");
          }

          if (action === "stats") {
            const from = new Date(); from.setDate(from.getDate() - 30);
            const { data: att } = await supabaseAdmin.from("attendance")
              .select("status").eq("student_id", student.id).gte("date", from.toISOString().slice(0, 10));
            const present = (att ?? []).filter((a) => a.status === "present").length;
            const absent = (att ?? []).filter((a) => a.status === "absent").length;
            const late = (att ?? []).filter((a) => a.status === "late").length;
            const { data: grades } = await supabaseAdmin.from("grades")
              .select("score, max_score, created_at")
              .eq("student_id", student.id).order("created_at", { ascending: false }).limit(5);
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
            await reply(chat, lines.join("\n"));
            return new Response("ok");
          }

          await reply(chat, "Menyudan tanlang:", mainMenu);
          return new Response("ok");
        }
      },
    },
  },
});
