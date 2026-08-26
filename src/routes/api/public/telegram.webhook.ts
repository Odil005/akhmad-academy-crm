import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  isOwnTelegramContact,
  isPrivateTelegramChat,
  makeTeacherCallback,
  parseTeacherCallback,
} from "@/features/telegram/domain";

/** Derive a Telegram-safe (hex) webhook secret from the bot token. */
function deriveWebhookSecret(token: string): string {
  return createHash("sha256").update(`telegram-webhook:${token}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

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
const MENU_PAYMENT = "💳 To'lov holati";
const MENU_RECEIPT = "🧾 Chek yuborish";
const MENU_STATS = "📊 Davomat";
const MENU_AI = "🤖 AI yordamchi";
const MENU_HOME = "🏠 Bosh menyu";
const STAFF_TODAY = "📅 Bugungi darslar";
const STAFF_MESSAGES = "💬 Ota-ona xabarlari";
const STAFF_ATTENDANCE = "✅ Davomat holati";
const STAFF_REPORT = "📊 Kunlik hisobot";
const STAFF_STATUS = "🛡 Tizim holati";
const STAFF_HOME = "🏠 Xodim menyusi";
const TEACHER_GROUPS = "👥 Guruhlarim";
const TEACHER_KPI = "📈 Mening KPI";
const TEACHER_BALANCE = "💰 Balansim";
const DIR_FINANCE = "💵 Moliya";
const DIR_DEBTORS = "🔴 Qarzdorlar";
const DIR_STUDENTS = "👥 O'quvchi va guruhlar";
const DIR_TEACHERS = "👨‍🏫 O'qituvchilar";
const DIR_LEADS = "📞 Lidlar";
const STUDENT_TODAY = "📅 Darslarim";
const STUDENT_WEEK = "🗓 Haftalik jadval";
const STUDENT_ATTENDANCE = "✅ Davomatim";
const STUDENT_PAYMENT = "💳 To'lovim";
const STUDENT_RESULTS = "🏆 Natijalarim";
const STUDENT_VIDEO = "🎥 Video darslar";
const STUDENT_PROFILE = "👤 Profilim";
const STUDENT_HOME = "🏠 O'quvchi menyusi";

type Contact = { phone_number: string; first_name?: string; last_name?: string; user_id?: number };
type Msg = {
  chat?: { id: number; type?: string; first_name?: string; last_name?: string; username?: string };
  from?: { id: number };
  text?: string;
  caption?: string;
  contact?: Contact;
  photo?: Array<{ file_id: string; file_size?: number }>;
  document?: { file_id: string; mime_type?: string };
  reply_to_message?: { text?: string };
};
type Update = {
  update_id?: number;
  message?: Msg;
  callback_query?: {
    id: string;
    from: { id: number };
    message?: { chat: { id: number; type?: string }; message_id: number };
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
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) return new Response("Bot token not configured", { status: 503 });
        // Accept either an explicit TELEGRAM_WEBHOOK_SECRET (raw or sanitized to
        // Telegram-safe characters) or the hex secret derived from the bot token.
        const explicit = (process.env.TELEGRAM_WEBHOOK_SECRET ?? "").trim();
        const candidates = [
          explicit,
          explicit.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 256),
          deriveWebhookSecret(botToken),
        ].filter((value) => value.length >= 1);
        const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!candidates.some((candidate) => safeEqual(provided, candidate))) {
          return new Response("Unauthorized", { status: 401 });
        }


        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let update: Update;
        try {
          update = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const { callTelegram, hashTelegramLinkToken, sendTelegramText } =
          await import("@/lib/telegram.server");
        const tg = (method: string, body: unknown) => callTelegram(method, body);
        const reply = (chat_id: number, text: string, extra: Record<string, unknown> = {}) =>
          sendTelegramText(chat_id, text, extra);

        const trackedUpdateId = Number.isSafeInteger(update.update_id) ? update.update_id! : null;
        if (trackedUpdateId !== null) {
          const updateKind = update.callback_query
            ? "callback_query"
            : update.message
              ? "message"
              : "unknown";
          const updateChatId =
            update.message?.chat?.id ?? update.callback_query?.message?.chat?.id ?? null;
          const claim = await supabaseAdmin.rpc("claim_telegram_update", {
            p_update_id: trackedUpdateId,
            p_update_kind: updateKind,
            p_chat_id: updateChatId === null ? "" : String(updateChatId),
          });
          if (!claim.error && !claim.data) return new Response("ok");
          if (claim.error && !["PGRST202", "42883"].includes(claim.error.code ?? "")) {
            return new Response("Webhook vaqtincha band", { status: 503 });
          }
        }

        const processUpdate = async (): Promise<Response> => {
          const mainMenu = {
            reply_markup: {
              keyboard: [
                [{ text: MENU_PAYMENT }, { text: MENU_RECEIPT }],
                [{ text: MENU_STATS }, { text: MENU_TEACHER }],
                [{ text: MENU_ANSWERS }, { text: MENU_MEETING }],
                [{ text: MENU_AI }, { text: MENU_HOME }],
              ],
              resize_keyboard: true,
            },
          };

          const teacherMenu = {
            reply_markup: {
              keyboard: [
                [{ text: STAFF_TODAY }, { text: STAFF_ATTENDANCE }],
                [{ text: TEACHER_GROUPS }, { text: STAFF_MESSAGES }],
                [{ text: TEACHER_KPI }, { text: TEACHER_BALANCE }],
                [{ text: STAFF_HOME }],
              ],
              resize_keyboard: true,
            },
          };

          const directorMenu = {
            reply_markup: {
              keyboard: [
                [{ text: STAFF_REPORT }, { text: DIR_FINANCE }],
                [{ text: DIR_DEBTORS }, { text: DIR_STUDENTS }],
                [{ text: DIR_TEACHERS }, { text: DIR_LEADS }],
                [{ text: STAFF_TODAY }, { text: STAFF_STATUS }],
                [{ text: STAFF_HOME }],
              ],
              resize_keyboard: true,
            },
          };

          const staffMenu = (role: string) => (role === "teacher" ? teacherMenu : directorMenu);

          const studentMenu = {
            reply_markup: {
              keyboard: [
                [{ text: STUDENT_TODAY }, { text: STUDENT_WEEK }],
                [{ text: STUDENT_ATTENDANCE }, { text: STUDENT_PAYMENT }],
                [{ text: STUDENT_RESULTS }, { text: STUDENT_VIDEO }],
                [{ text: STUDENT_PROFILE }, { text: STUDENT_HOME }],
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
              `Assalomu alaykum! Akhmad Academy botiga xush kelibsiz.\n\n${extra}Farzandingizga xavfsiz ulanish uchun pastdagi "📱 Telefon raqamni yuborish" tugmasini bosing. Faqat Telegram akkauntingizning o'z raqami qabul qilinadi.\n\nRaqam CRMdagi ma'lumot bilan mos kelmasa, administrator sizga bir martalik ulanish havolasini beradi.`.trim(),
              contactPrompt,
            );

          const linkedStudents = async (chatId: number) => {
            const { data } = await supabaseAdmin
              .from("students")
              .select("id, first_name, last_name, group_id")
              .eq("parent_telegram_chat_id", String(chatId));
            return data ?? [];
          };

          type LinkedStudent = {
            id: string;
            first_name: string | null;
            last_name: string | null;
            full_name: string | null;
            group_id: string | null;
            status_enum: string;
          };

          const linkedStudentAccount = async (chatId: number): Promise<LinkedStudent | null> => {
            const { data } = await supabaseAdmin
              .from("students")
              .select("id, first_name, last_name, full_name, group_id, status_enum")
              .eq("telegram_chat_id", String(chatId))
              .limit(2);
            return data?.length === 1 ? data[0] : null;
          };

          type LinkedStaff = {
            user_id: string;
            role: string;
            full_name: string | null;
            notifications_enabled: boolean;
          };

          const linkedStaff = async (chatId: number): Promise<LinkedStaff | null> => {
            const { data } = await supabaseAdmin
              .from("staff_telegram_links")
              .select("user_id, role, full_name, notifications_enabled")
              .eq("telegram_chat_id", String(chatId))
              .maybeSingle();
            if (!data) return null;
            const { data: actualRoles } = await supabaseAdmin
              .from("user_roles")
              .select("role")
              .eq("user_id", data.user_id);
            return (actualRoles ?? []).some((row) => row.role === data.role) ? data : null;
          };

          const tashkentDay = () => {
            const parts = new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Tashkent",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              weekday: "short",
            }).formatToParts(new Date());
            const get = (type: Intl.DateTimeFormatPartTypes) =>
              parts.find((part) => part.type === type)?.value ?? "";
            const weekday =
              { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[get("weekday")] ?? 1;
            return { date: `${get("year")}-${get("month")}-${get("day")}`, weekday };
          };

          const sendStaffToday = async (staff: LinkedStaff, chat: number) => {
            const { date, weekday } = tashkentDay();
            let query = supabaseAdmin
              .from("lessons")
              .select(
                "start_time, end_time, group:groups(name), subject:subjects(name), room:rooms(name)",
              )
              .eq("is_active", true)
              .eq("day_of_week", weekday)
              .order("start_time");
            if (staff.role === "teacher") query = query.eq("teacher_user_id", staff.user_id);
            const { data: lessons } = await query.limit(30);
            const rows = (lessons ?? []) as Array<{
              start_time: string;
              end_time: string;
              group: { name: string } | null;
              subject: { name: string } | null;
              room: { name: string } | null;
            }>;
            if (!rows.length) {
              await reply(chat, `📅 ${date}\nBugun dars yo'q.`, staffMenu(staff.role));
              return;
            }
            const lines = rows.map((lesson) => {
              const time = `${lesson.start_time.slice(0, 5)}–${lesson.end_time.slice(0, 5)}`;
              return `• ${time} — ${lesson.group?.name ?? "Guruh"}\n  ${lesson.subject?.name ?? "Fan"}${lesson.room?.name ? ` · ${lesson.room.name}` : ""}`;
            });
            await reply(
              chat,
              `📅 Bugungi darslar — ${date}\n\n${lines.join("\n")}`,
              staffMenu(staff.role),
            );
          };

          const sendStaffMessages = async (staff: LinkedStaff, chat: number) => {
            if (staff.role !== "teacher") {
              await reply(chat, "Bu bo'lim o'qituvchilar uchun.", staffMenu(staff.role));
              return;
            }
            const { data: messages } = await supabaseAdmin
              .from("parent_teacher_messages")
              .select("message, created_at, student:students(first_name, last_name)")
              .eq("teacher_id", staff.user_id)
              .eq("sender_role", "parent")
              .is("read_at", null)
              .order("created_at", { ascending: false })
              .limit(10);
            const rows = (messages ?? []) as Array<{
              message: string;
              created_at: string;
              student: { first_name: string | null; last_name: string | null } | null;
            }>;
            if (!rows.length) {
              await reply(chat, "✅ Yangi ota-ona xabari yo'q.", staffMenu(staff.role));
              return;
            }
            const lines = rows.map((row) => {
              const student =
                `${row.student?.first_name ?? ""} ${row.student?.last_name ?? ""}`.trim() ||
                "O'quvchi";
              return `• ${student}: ${row.message}`;
            });
            await reply(
              chat,
              `💬 O'qilmagan xabarlar (${rows.length})\n\n${lines.join("\n\n")}`,
              staffMenu(staff.role),
            );
          };

          const sendStaffStatus = async (staff: LinkedStaff, chat: number) => {
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const [{ count: failed }, { count: pending }] = await Promise.all([
              supabaseAdmin
                .from("parent_notifications")
                .select("id", { count: "exact", head: true })
                .in("status", ["failed", "error"])
                .gte("created_at", since),
              supabaseAdmin
                .from("parent_notifications")
                .select("id", { count: "exact", head: true })
                .eq("status", "pending"),
            ]);
            const warning = Number(failed ?? 0);
            const waiting = Number(pending ?? 0);
            const icon = warning > 0 ? "🔴" : waiting > 20 ? "🟡" : "🟢";
            const detail =
              staff.role === "teacher"
                ? "CRM ichidagi indikator orqali batafsil holatni ko'ring."
                : `Yuborilmagan: ${waiting}\nXatolik (24 soat): ${warning}`;
            await reply(chat, `${icon} Tizim holati\n\n${detail}`, staffMenu(staff.role));
          };

          const sendStaffAttendance = async (staff: LinkedStaff, chat: number) => {
            const { date, weekday } = tashkentDay();
            let lessonQuery = supabaseAdmin
              .from("lessons")
              .select("id, end_time, group:groups(name)")
              .eq("is_active", true)
              .eq("day_of_week", weekday)
              .order("end_time");
            if (staff.role === "teacher") {
              lessonQuery = lessonQuery.eq("teacher_user_id", staff.user_id);
            }
            const { data: lessons } = await lessonQuery.limit(100);
            const lessonRows = (lessons ?? []) as Array<{
              id: string;
              end_time: string;
              group: { name: string } | null;
            }>;
            if (!lessonRows.length) {
              await reply(chat, "Bugun nazorat qilinadigan dars yo'q.", staffMenu(staff.role));
              return;
            }
            const { data: attendanceRows } = await supabaseAdmin
              .from("attendance")
              .select("lesson_id")
              .eq("date", date)
              .in(
                "lesson_id",
                lessonRows.map((lesson) => lesson.id),
              );
            const marked = new Set((attendanceRows ?? []).map((row) => row.lesson_id));
            const nowTime = new Intl.DateTimeFormat("en-GB", {
              timeZone: "Asia/Tashkent",
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23",
            }).format(new Date());
            const pending = lessonRows.filter(
              (lesson) => lesson.end_time.slice(0, 5) < nowTime && !marked.has(lesson.id),
            );
            if (!pending.length) {
              await reply(
                chat,
                "✅ Tugagan darslarning davomati kiritilgan.",
                staffMenu(staff.role),
              );
              return;
            }
            await reply(
              chat,
              `🟠 Davomat kutilmoqda (${pending.length})\n\n${pending
                .map(
                  (lesson) =>
                    `• ${lesson.group?.name ?? "Guruh"} — ${lesson.end_time.slice(0, 5)} da tugagan`,
                )
                .join("\n")}`,
              staffMenu(staff.role),
            );
          };

          const sendStaffReport = async (staff: LinkedStaff, chat: number) => {
            if (staff.role === "teacher") {
              await reply(
                chat,
                "Bu bo'lim administrator va direktor uchun.",
                staffMenu(staff.role),
              );
              return;
            }
            const centerReport = await supabaseAdmin.rpc("telegram_center_report");
            const reportRow = centerReport.data?.[0];
            if (!centerReport.error && reportRow) {
              await reply(
                chat,
                `📊 Markaz hisoboti\n\nFaol o'quvchilar: ${reportRow.active_students}\nGuruhlar: ${reportRow.groups_count}\nQarzdorlar: ${reportRow.debtors}\nUmumiy qarzdorlik: ${Number(reportRow.debt_total).toLocaleString("uz-UZ")} so'm`,
                staffMenu(staff.role),
              );
              return;
            }
            const [activeStudents, groups, pendingPayments] = await Promise.all([
              supabaseAdmin
                .from("students")
                .select("id", { count: "exact", head: true })
                .eq("status_enum", "active"),
              supabaseAdmin.from("groups").select("id", { count: "exact", head: true }),
              supabaseAdmin
                .from("payments")
                .select("student_id, amount, total_amount")
                .eq("status", "pending")
                .limit(10_000),
            ]);
            const debts = pendingPayments.data ?? [];
            const debtors = new Set(
              debts
                .filter((payment) => Number(payment.total_amount || payment.amount || 0) > 0)
                .map((payment) => payment.student_id),
            ).size;
            const debtTotal = debts.reduce(
              (sum, payment) => sum + Number(payment.total_amount || payment.amount || 0),
              0,
            );
            await reply(
              chat,
              `📊 Markaz hisoboti\n\nFaol o'quvchilar: ${activeStudents.count ?? 0}\nGuruhlar: ${groups.count ?? 0}\nQarzdorlar: ${debtors}\nUmumiy qarzdorlik: ${debtTotal.toLocaleString("uz-UZ")} so'm`,
              staffMenu(staff.role),
            );
          };

          const sendStudentToday = async (student: LinkedStudent, chat: number) => {
            const { date, weekday } = tashkentDay();
            const { data: enrollments } = await supabaseAdmin
              .from("student_enrollments")
              .select("group_id")
              .eq("student_id", student.id)
              .in("status", ["active", "trial"])
              .is("ended_at", null);
            const groupIds = Array.from(
              new Set(
                [student.group_id, ...(enrollments ?? []).map((row) => row.group_id)].filter(
                  Boolean,
                ),
              ),
            ) as string[];
            if (!groupIds.length) {
              await reply(chat, "Siz hali faol guruhga biriktirilmagansiz.", studentMenu);
              return;
            }
            const { data: lessons } = await supabaseAdmin
              .from("lessons")
              .select(
                "start_time, end_time, group:groups(name), subject:subjects(name), room:rooms(name)",
              )
              .eq("is_active", true)
              .eq("day_of_week", weekday)
              .in("group_id", groupIds)
              .order("start_time");
            const rows = (lessons ?? []) as Array<{
              start_time: string;
              end_time: string;
              group: { name: string } | null;
              subject: { name: string } | null;
              room: { name: string } | null;
            }>;
            if (!rows.length) {
              await reply(chat, `📅 ${date}\nBugun dars yo'q.`, studentMenu);
              return;
            }
            await reply(
              chat,
              `📅 Bugungi darslar — ${date}\n\n${rows
                .map(
                  (lesson) =>
                    `• ${lesson.start_time.slice(0, 5)}–${lesson.end_time.slice(0, 5)} — ${lesson.subject?.name ?? "Fan"}\n  ${lesson.group?.name ?? "Guruh"}${lesson.room?.name ? ` · ${lesson.room.name}` : ""}`,
                )
                .join("\n")}`,
              studentMenu,
            );
          };

          const sendStudentProfile = async (student: LinkedStudent, chat: number) => {
            const { data: enrollments } = await supabaseAdmin
              .from("student_enrollments")
              .select("group:groups(name, subject:subjects(name))")
              .eq("student_id", student.id)
              .in("status", ["active", "trial"])
              .is("ended_at", null);
            const groups = (enrollments ?? []) as Array<{
              group: { name: string; subject: { name: string } | null } | null;
            }>;
            const name =
              student.full_name ||
              `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() ||
              "O'quvchi";
            const groupLines = groups.length
              ? groups.map(
                  (row) =>
                    `• ${row.group?.name ?? "Guruh"}${row.group?.subject?.name ? ` — ${row.group.subject.name}` : ""}`,
                )
              : ["• Faol guruh topilmadi"];
            await reply(
              chat,
              `👤 Profilim\n\n${name}\nHolat: ${student.status_enum}\nGuruhlar:\n${groupLines.join("\n")}`,
              studentMenu,
            );
          };

          const money = (value: unknown) =>
            `${Number(value ?? 0).toLocaleString("uz-UZ")} so'm`;

          const WEEK_NAMES = [
            "",
            "Dushanba",
            "Seshanba",
            "Chorshanba",
            "Payshanba",
            "Juma",
            "Shanba",
            "Yakshanba",
          ];

          /** All active group ids for a student (main group + enrollments). */
          const studentGroupIds = async (student: LinkedStudent): Promise<string[]> => {
            const { data } = await supabaseAdmin
              .from("student_enrollments")
              .select("group_id")
              .eq("student_id", student.id)
              .in("status", ["active", "trial"])
              .is("ended_at", null);
            return Array.from(
              new Set(
                [student.group_id, ...(data ?? []).map((row) => row.group_id)].filter(Boolean),
              ),
            ) as string[];
          };

          const sendStudentWeek = async (student: LinkedStudent, chat: number) => {
            const groupIds = await studentGroupIds(student);
            if (!groupIds.length) {
              await reply(chat, "Siz hali faol guruhga biriktirilmagansiz.", studentMenu);
              return;
            }
            const { data } = await supabaseAdmin
              .from("lessons")
              .select(
                "day_of_week, start_time, end_time, group:groups(name), subject:subjects(name), room:rooms(name)",
              )
              .eq("is_active", true)
              .in("group_id", groupIds)
              .order("day_of_week")
              .order("start_time")
              .limit(80);
            const rows = (data ?? []) as Array<{
              day_of_week: number;
              start_time: string;
              end_time: string;
              group: { name: string } | null;
              subject: { name: string } | null;
              room: { name: string } | null;
            }>;
            if (!rows.length) {
              await reply(chat, "🗓 Haftalik jadval hali kiritilmagan.", studentMenu);
              return;
            }
            const byDay = new Map<number, string[]>();
            for (const row of rows) {
              const line = `  • ${row.start_time.slice(0, 5)}–${row.end_time.slice(0, 5)} ${row.subject?.name ?? "Fan"}${row.room?.name ? ` · ${row.room.name}` : ""}`;
              byDay.set(row.day_of_week, [...(byDay.get(row.day_of_week) ?? []), line]);
            }
            const text = Array.from(byDay.entries())
              .sort((a, b) => a[0] - b[0])
              .map(([day, lines]) => `${WEEK_NAMES[day] ?? day}\n${lines.join("\n")}`)
              .join("\n\n");
            await reply(chat, `🗓 Haftalik jadval\n\n${text}`, studentMenu);
          };

          const sendStudentResults = async (student: LinkedStudent, chat: number) => {
            const [grades, behavior] = await Promise.all([
              supabaseAdmin
                .from("grades")
                .select("score, max_score, kind, graded_at")
                .eq("student_id", student.id)
                .order("graded_at", { ascending: false })
                .limit(10),
              supabaseAdmin
                .from("behavior_evaluations")
                .select("rating, comment, lesson_date")
                .eq("student_id", student.id)
                .order("lesson_date", { ascending: false })
                .limit(5),
            ]);
            const gradeRows = grades.data ?? [];
            const behaviorRows = behavior.data ?? [];
            if (!gradeRows.length && !behaviorRows.length) {
              await reply(chat, "🏆 Hozircha baho va fikr kiritilmagan.", studentMenu);
              return;
            }
            const percents = gradeRows
              .map((row) =>
                Number(row.max_score) > 0
                  ? (Number(row.score) / Number(row.max_score)) * 100
                  : null,
              )
              .filter((value): value is number => value !== null);
            const avg = percents.length
              ? Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length)
              : null;
            const parts = [`🏆 Natijalarim`];
            if (avg !== null) parts.push(`O'rtacha ko'rsatkich: ${avg}%`);
            if (gradeRows.length) {
              parts.push(
                `\n📝 Oxirgi baholar:\n${gradeRows
                  .map(
                    (row) =>
                      `• ${String(row.graded_at).slice(0, 10)} — ${row.score}/${row.max_score}${row.kind ? ` (${row.kind})` : ""}`,
                  )
                  .join("\n")}`,
              );
            }
            if (behaviorRows.length) {
              parts.push(
                `\n💬 O'qituvchi fikri:\n${behaviorRows
                  .map(
                    (row) =>
                      `• ${String(row.lesson_date).slice(0, 10)} — ${row.rating}${row.comment ? `: ${row.comment}` : ""}`,
                  )
                  .join("\n")}`,
              );
            }
            await reply(chat, parts.join("\n"), studentMenu);
          };

          const sendStudentVideos = async (student: LinkedStudent, chat: number) => {
            const groupIds = await studentGroupIds(student);
            if (!groupIds.length) {
              await reply(chat, "🎥 Guruh biriktirilmagani uchun video dars yo'q.", studentMenu);
              return;
            }
            const { data } = await supabaseAdmin
              .from("video_lessons")
              .select("title, description, created_at, group:groups(name)")
              .eq("published", true)
              .in("group_id", groupIds)
              .order("created_at", { ascending: false })
              .limit(10);
            const rows = (data ?? []) as Array<{
              title: string;
              description: string | null;
              created_at: string;
              group: { name: string } | null;
            }>;
            if (!rows.length) {
              await reply(chat, "🎥 Hozircha video dars yuklanmagan.", studentMenu);
              return;
            }
            await reply(
              chat,
              `🎥 Video darslar (${rows.length})\n\n${rows
                .map(
                  (row) =>
                    `• ${row.title}${row.group?.name ? ` — ${row.group.name}` : ""}\n  ${String(row.created_at).slice(0, 10)}${row.description ? `\n  ${row.description}` : ""}`,
                )
                .join("\n")}\n\nVideoni ko'rish uchun o'quvchi ilovasidagi "Video darslar" bo'limiga kiring.`,
              studentMenu,
            );
          };

          /** Group ids the teacher owns (as group teacher or lesson teacher). */
          const teacherGroupIds = async (userId: string): Promise<string[]> => {
            const [owned, lessons] = await Promise.all([
              supabaseAdmin.from("groups").select("id").eq("teacher_id", userId).limit(100),
              supabaseAdmin
                .from("lessons")
                .select("group_id")
                .eq("teacher_user_id", userId)
                .limit(300),
            ]);
            return Array.from(
              new Set(
                [
                  ...(owned.data ?? []).map((row) => row.id),
                  ...(lessons.data ?? []).map((row) => row.group_id),
                ].filter(Boolean),
              ),
            ) as string[];
          };

          const sendTeacherGroups = async (staff: LinkedStaff, chat: number) => {
            const groupIds = await teacherGroupIds(staff.user_id);
            if (!groupIds.length) {
              await reply(chat, "👥 Sizga hali guruh biriktirilmagan.", teacherMenu);
              return;
            }
            const [groups, students] = await Promise.all([
              supabaseAdmin
                .from("groups")
                .select("id, name, subject:subjects(name)")
                .in("id", groupIds)
                .limit(50),
              supabaseAdmin
                .from("students")
                .select("first_name, last_name, full_name, group_id")
                .in("group_id", groupIds)
                .eq("status_enum", "active")
                .limit(500),
            ]);
            const groupRows = (groups.data ?? []) as Array<{
              id: string;
              name: string;
              subject: { name: string } | null;
            }>;
            const studentRows = students.data ?? [];
            const text = groupRows
              .map((group) => {
                const list = studentRows.filter((row) => row.group_id === group.id);
                const names = list
                  .slice(0, 25)
                  .map(
                    (row, index) =>
                      `  ${index + 1}. ${row.full_name || `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "O'quvchi"}`,
                  )
                  .join("\n");
                return `👥 ${group.name}${group.subject?.name ? ` — ${group.subject.name}` : ""} (${list.length} o'quvchi)\n${names || "  O'quvchi yo'q"}`;
              })
              .join("\n\n");
            await reply(chat, `Mening guruhlarim (${groupRows.length})\n\n${text}`, teacherMenu);
          };

          const sendTeacherKpi = async (staff: LinkedStaff, chat: number) => {
            const groupIds = await teacherGroupIds(staff.user_id);
            const monthStart = new Date();
            monthStart.setUTCDate(1);
            const since = monthStart.toISOString().slice(0, 10);
            const [lessons, studentCount, attendance] = await Promise.all([
              supabaseAdmin
                .from("lessons")
                .select("id", { count: "exact", head: true })
                .eq("teacher_user_id", staff.user_id)
                .eq("is_active", true),
              groupIds.length
                ? supabaseAdmin
                    .from("students")
                    .select("id", { count: "exact", head: true })
                    .in("group_id", groupIds)
                    .eq("status_enum", "active")
                : Promise.resolve({ count: 0 }),
              supabaseAdmin
                .from("attendance")
                .select("status")
                .gte("date", since)
                .in("status", ["present", "late", "absent"])
                .eq("marked_by", staff.user_id)
                .limit(5000),
            ]);
            const marks = (attendance as { data?: Array<{ status: string }> }).data ?? [];
            const ok = marks.filter((row) => row.status !== "absent").length;
            const rate = marks.length ? Math.round((ok / marks.length) * 100) : null;
            await reply(
              chat,
              `📈 Mening KPI\n\nHaftalik faol darslar: ${lessons.count ?? 0}\nFaol o'quvchilar: ${(studentCount as { count?: number }).count ?? 0}\nGuruhlar: ${groupIds.length}\nOy boshidan kiritilgan davomat: ${marks.length}${rate !== null ? `\nDarsga kelish darajasi: ${rate}%` : ""}`,
              teacherMenu,
            );
          };

          const sendTeacherBalance = async (staff: LinkedStaff, chat: number) => {
            const { data } = await supabaseAdmin
              .from("teacher_balance")
              .select("period_month, salary, bonus, penalty, kpi_score, percent_earning, note")
              .eq("teacher_user_id", staff.user_id)
              .eq("visible_to_teacher", true)
              .order("period_month", { ascending: false })
              .limit(3);
            const rows = data ?? [];
            if (!rows.length) {
              await reply(
                chat,
                "💰 Hozircha oylik hisob-kitob e'lon qilinmagan.",
                teacherMenu,
              );
              return;
            }
            await reply(
              chat,
              `💰 Balansim\n\n${rows
                .map((row) => {
                  const total =
                    Number(row.salary ?? 0) +
                    Number(row.bonus ?? 0) +
                    Number(row.percent_earning ?? 0) -
                    Number(row.penalty ?? 0);
                  return `• ${String(row.period_month).slice(0, 7)}\n  Oylik: ${money(row.salary)}\n  Bonus: ${money(row.bonus)}\n  Ulush: ${money(row.percent_earning)}\n  Jarima: ${money(row.penalty)}\n  Jami: ${money(total)}${row.kpi_score ? `\n  KPI: ${row.kpi_score}` : ""}${row.note ? `\n  ${row.note}` : ""}`;
                })
                .join("\n\n")}`,
              teacherMenu,
            );
          };

          const sendDirectorFinance = async (chat: number) => {
            const { date } = tashkentDay();
            const monthStart = `${date.slice(0, 7)}-01`;
            const [monthPaid, todayPaid, pending, shift] = await Promise.all([
              supabaseAdmin
                .from("payments")
                .select("amount, total_amount")
                .eq("status", "paid")
                .gte("paid_at", `${monthStart}T00:00:00Z`)
                .limit(10_000),
              supabaseAdmin
                .from("payments")
                .select("amount, total_amount")
                .eq("status", "paid")
                .gte("paid_at", `${date}T00:00:00Z`)
                .limit(2000),
              supabaseAdmin
                .from("payments")
                .select("amount, total_amount")
                .eq("status", "pending")
                .limit(10_000),
              supabaseAdmin
                .from("cash_shifts")
                .select("shift_date, difference, closed_at")
                .order("shift_date", { ascending: false })
                .limit(1),
            ]);
            const sum = (rows: Array<{ amount: unknown; total_amount: unknown }> | null) =>
              (rows ?? []).reduce(
                (acc, row) => acc + Number(row.total_amount || row.amount || 0),
                0,
              );
            const lastShift = shift.data?.[0];
            await reply(
              chat,
              `💵 Moliya\n\nBugungi tushum: ${money(sum(todayPaid.data))}\nOylik tushum: ${money(sum(monthPaid.data))}\nKutilayotgan to'lov: ${money(sum(pending.data))}\n\n🧾 Oxirgi kassa smenasi: ${
                lastShift
                  ? `${lastShift.shift_date} — ${lastShift.closed_at ? "yopilgan" : "ochiq"}${
                      lastShift.difference ? `, farq: ${money(lastShift.difference)}` : ""
                    }`
                  : "ma'lumot yo'q"
              }`,
              directorMenu,
            );
          };

          const sendDirectorDebtors = async (chat: number) => {
            const { data, error } = await supabaseAdmin.rpc("debtors_overview");
            if (error || !data) {
              await reply(chat, "🔴 Qarzdorlik ma'lumotini olish imkoni bo'lmadi.", directorMenu);
              return;
            }
            const rows = data as Array<{
              student_name: string;
              group_name: string | null;
              debt_total: number;
              periods: number;
              days_overdue: number;
            }>;
            if (!rows.length) {
              await reply(chat, "✅ Qarzdor o'quvchi yo'q.", directorMenu);
              return;
            }
            const total = rows.reduce((sum, row) => sum + Number(row.debt_total ?? 0), 0);
            await reply(
              chat,
              `🔴 Qarzdorlar: ${rows.length}\nUmumiy qarz: ${money(total)}\n\nEng katta 15 ta:\n${rows
                .slice(0, 15)
                .map(
                  (row, index) =>
                    `${index + 1}. ${row.student_name}${row.group_name ? ` (${row.group_name})` : ""} — ${money(row.debt_total)} · ${row.periods} oy`,
                )
                .join("\n")}`,
              directorMenu,
            );
          };

          const sendDirectorStudents = async (chat: number) => {
            const [total, active, trial, frozen, groups, subjects] = await Promise.all([
              supabaseAdmin.from("students").select("id", { count: "exact", head: true }),
              supabaseAdmin
                .from("students")
                .select("id", { count: "exact", head: true })
                .eq("status_enum", "active"),
              supabaseAdmin
                .from("students")
                .select("id", { count: "exact", head: true })
                .eq("status_enum", "trial"),
              supabaseAdmin
                .from("students")
                .select("id", { count: "exact", head: true })
                .eq("status_enum", "frozen"),
              supabaseAdmin.from("groups").select("id, name, subject:subjects(name)").limit(200),
              supabaseAdmin
                .from("students")
                .select("group_id")
                .eq("status_enum", "active")
                .limit(5000),
            ]);
            const groupRows = (groups.data ?? []) as Array<{
              id: string;
              name: string;
              subject: { name: string } | null;
            }>;
            const counts = new Map<string, number>();
            for (const row of subjects.data ?? []) {
              const group = groupRows.find((item) => item.id === row.group_id);
              const key = group?.subject?.name ?? "Fan belgilanmagan";
              counts.set(key, (counts.get(key) ?? 0) + 1);
            }
            const bySubject = Array.from(counts.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => `• ${name}: ${count} o'quvchi`)
              .join("\n");
            await reply(
              chat,
              `👥 O'quvchi va guruhlar\n\nJami: ${total.count ?? 0}\nFaol: ${active.count ?? 0}\nSinov: ${trial.count ?? 0}\nMuzlatilgan: ${frozen.count ?? 0}\nGuruhlar: ${groupRows.length}\n\n📚 Fanlar bo'yicha:\n${bySubject || "• Ma'lumot yo'q"}`,
              directorMenu,
            );
          };

          const sendDirectorTeachers = async (chat: number) => {
            const { date, weekday } = tashkentDay();
            const [lessons, teachers] = await Promise.all([
              supabaseAdmin
                .from("lessons")
                .select("id, teacher_user_id, end_time, group:groups(name)")
                .eq("is_active", true)
                .eq("day_of_week", weekday)
                .limit(200),
              supabaseAdmin
                .from("profiles")
                .select("id, full_name")
                .limit(500),
            ]);
            const lessonRows = (lessons.data ?? []) as Array<{
              id: string;
              teacher_user_id: string | null;
              end_time: string;
              group: { name: string } | null;
            }>;
            if (!lessonRows.length) {
              await reply(chat, `👨‍🏫 ${date}: bugun dars yo'q.`, directorMenu);
              return;
            }
            const { data: attendanceRows } = await supabaseAdmin
              .from("attendance")
              .select("lesson_id")
              .eq("date", date)
              .in(
                "lesson_id",
                lessonRows.map((row) => row.id),
              );
            const marked = new Set((attendanceRows ?? []).map((row) => row.lesson_id));
            const nowTime = new Intl.DateTimeFormat("en-GB", {
              timeZone: "Asia/Tashkent",
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23",
            }).format(new Date());
            const nameOf = (id: string | null) =>
              (teachers.data ?? []).find((row) => row.id === id)?.full_name || "O'qituvchi";
            const missing = lessonRows.filter(
              (row) => row.end_time.slice(0, 5) < nowTime && !marked.has(row.id),
            );
            await reply(
              chat,
              `👨‍🏫 O'qituvchilar — ${date}\n\nBugungi darslar: ${lessonRows.length}\nDavomat kiritilgan: ${marked.size}\nKiritilmagan: ${missing.length}\n\n${
                missing.length
                  ? `🟠 Muammoli:\n${missing
                      .slice(0, 15)
                      .map(
                        (row) =>
                          `• ${nameOf(row.teacher_user_id)} — ${row.group?.name ?? "Guruh"} (${row.end_time.slice(0, 5)})`,
                      )
                      .join("\n")}`
                  : "✅ Barcha tugagan darslar davomati kiritilgan."
              }`,
              directorMenu,
            );
          };

          const sendDirectorLeads = async (chat: number) => {
            const { data } = await supabaseAdmin
              .from("leads")
              .select("name, phone, course, status, created_at")
              .order("created_at", { ascending: false })
              .limit(200);
            const rows = data ?? [];
            if (!rows.length) {
              await reply(chat, "📞 Hozircha lid yo'q.", directorMenu);
              return;
            }
            const converted = rows.filter((row) =>
              ["converted", "enrolled", "won"].includes(String(row.status)),
            ).length;
            const fresh = rows.filter((row) => String(row.status) === "new");
            await reply(
              chat,
              `📞 Lidlar\n\nJami (oxirgi 200): ${rows.length}\nYangi: ${fresh.length}\nKonversiya: ${Math.round((converted / rows.length) * 100)}%\n\n🆕 Oxirgi yangi murojaatlar:\n${
                fresh
                  .slice(0, 10)
                  .map(
                    (row) =>
                      `• ${row.name ?? "Noma'lum"} — ${row.phone ?? "-"}${row.course ? ` · ${row.course}` : ""}`,
                  )
                  .join("\n") || "• yo'q"
              }`,
              directorMenu,
            );
          };



          const handleStudentCommand = async (
            student: LinkedStudent,
            chat: number,
            command: string,
          ) => {
            const fullName =
              student.full_name ||
              `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() ||
              "O'quvchi";
            if (command === STUDENT_TODAY || command === "/today") {
              await sendStudentToday(student, chat);
              return true;
            }
            if (command === STUDENT_ATTENDANCE || command === "/attendance") {
              await reply(chat, await statsSummary(student.id, fullName), studentMenu);
              return true;
            }
            if (command === STUDENT_PAYMENT) {
              await reply(chat, await paymentSummary(student.id, fullName), studentMenu);
              return true;
            }
            if (command === STUDENT_WEEK || command === "/week") {
              await sendStudentWeek(student, chat);
              return true;
            }
            if (command === STUDENT_RESULTS || command === "/results") {
              await sendStudentResults(student, chat);
              return true;
            }
            if (command === STUDENT_VIDEO || command === "/video") {
              await sendStudentVideos(student, chat);
              return true;
            }
            if (command === STUDENT_PROFILE || command === "/status") {
              await sendStudentProfile(student, chat);
              return true;
            }

            if ([STUDENT_HOME, "/menu", "/help", "/start"].includes(command)) {
              await reply(chat, `Xush kelibsiz, ${fullName}!`, studentMenu);
              return true;
            }
            return false;
          };

          const handleStaffCommand = async (staff: LinkedStaff, chat: number, command: string) => {
            if (command === STAFF_TODAY || command === "/today") {
              await sendStaffToday(staff, chat);
              return true;
            }
            if (command === STAFF_MESSAGES || command === "/messages") {
              await sendStaffMessages(staff, chat);
              return true;
            }
            if (command === STAFF_STATUS || command === "/status") {
              await sendStaffStatus(staff, chat);
              return true;
            }
            if (command === STAFF_ATTENDANCE || command === "/attendance") {
              await sendStaffAttendance(staff, chat);
              return true;
            }
            if (command === STAFF_REPORT || command === "/report") {
              await sendStaffReport(staff, chat);
              return true;
            }
            if (staff.role === "teacher") {
              if (command === TEACHER_GROUPS || command === "/groups") {
                await sendTeacherGroups(staff, chat);
                return true;
              }
              if (command === TEACHER_KPI || command === "/kpi") {
                await sendTeacherKpi(staff, chat);
                return true;
              }
              if (command === TEACHER_BALANCE || command === "/balance") {
                await sendTeacherBalance(staff, chat);
                return true;
              }
            } else {
              if (command === DIR_FINANCE || command === "/finance") {
                await sendDirectorFinance(chat);
                return true;
              }
              if (command === DIR_DEBTORS || command === "/debtors") {
                await sendDirectorDebtors(chat);
                return true;
              }
              if (command === DIR_STUDENTS || command === "/students") {
                await sendDirectorStudents(chat);
                return true;
              }
              if (command === DIR_TEACHERS || command === "/teachers") {
                await sendDirectorTeachers(chat);
                return true;
              }
              if (command === DIR_LEADS || command === "/leads") {
                await sendDirectorLeads(chat);
                return true;
              }
            }
            if ([STAFF_HOME, "/menu", "/help", "/start"].includes(command)) {
              await reply(
                chat,
                `Xush kelibsiz, ${staff.full_name ?? "xodim"}!`,
                staffMenu(staff.role),
              );
              return true;
            }
            return false;
          };

          /** Link all matching students to this chat_id and greet the parent. */
          const linkAndGreet = async (
            chat: number,
            matches: Array<{
              id: string;
              first_name: string | null;
              last_name: string | null;
              parent_telegram_chat_id: string | null;
            }>,
          ) => {
            const targets = matches.filter(
              (s) => !s.parent_telegram_chat_id || s.parent_telegram_chat_id === String(chat),
            );
            if (!targets.length) {
              await reply(
                chat,
                "⚠️ Bu ma'lumot bilan boshqa akkaunt biriktirilgan. Iltimos, o'quv markazi ma'muriyatiga murojaat qiling.",
                mainMenu,
              );
              return;
            }
            for (const s of targets) {
              await supabaseAdmin
                .from("students")
                .update({
                  parent_telegram_chat_id: String(chat),
                  parent_notifications_enabled: true,
                })
                .eq("id", s.id);
            }
            const names = targets
              .map((s) => `• ${s.first_name ?? ""} ${s.last_name ?? ""}`.trim())
              .join("\n");
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
              .select(
                "id, first_name, last_name, full_name, parent_phone, parent_phones, parent_telegram_chat_id",
              );
            return (data ?? []) as Cand[];
          };

          const phonesOf = (s: Cand) =>
            [s.parent_phone, ...(s.parent_phones ?? [])]
              .map((p) => normalizePhone(p))
              .filter(Boolean);

          // ---------- callback_query (inline buttons) ----------
          if (update.callback_query) {
            const cq = update.callback_query;
            const chatId = cq.message?.chat.id;
            const data = cq.data ?? "";
            await tg("answerCallbackQuery", { callback_query_id: cq.id });
            if (!chatId) return new Response("ok");
            if (!isPrivateTelegramChat(cq.message?.chat.type) || cq.from.id !== chatId) {
              return new Response("ok");
            }

            const students = await linkedStudents(chatId);
            if (!students.length) {
              await askContact(chatId);
              return new Response("ok");
            }

            const [kind, ...rest] = data.split(":");
            if (kind === "pick") {
              const [studentId, action] = rest;
              const student = students.find((s) => s.id === studentId);
              if (!student) {
                await reply(chatId, "❌ O'quvchi mos kelmadi.");
                return new Response("ok");
              }
              return await handleAction(action, student, chatId);
            }
            const teacherCallback = parseTeacherCallback(data);
            if (teacherCallback) {
              const student = students.find((row) => row.id === teacherCallback.studentId);
              const { data: allowedTeachers } = student
                ? await supabaseAdmin.rpc("teachers_for_student", { _student_id: student.id })
                : { data: null };
              const allowed = (allowedTeachers ?? []).some(
                (row: { teacher_id: string }) => row.teacher_id === teacherCallback.teacherId,
              );
              if (!student || !allowed) {
                await reply(chatId, "O'qituvchi yoki o'quvchi mos kelmadi.");
                return new Response("ok");
              }
            }
            if (teacherCallback?.action === "tch") {
              const marker = `${ZWJ}tch|${teacherCallback.teacherId}|${teacherCallback.studentId}${ZWJ}`;
              await reply(
                chatId,
                `${marker}\n✍️ O'qituvchiga yubormoqchi bo'lgan xabaringizni shu xabarga JAVOB (reply) qilib yozing.`,
                { reply_markup: { force_reply: true, selective: true } },
              );
              return new Response("ok");
            }
            if (teacherCallback?.action === "meet") {
              const marker = `${ZWJ}meet|${teacherCallback.teacherId}|${teacherCallback.studentId}${ZWJ}`;
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
          const msg = update.message;
          const chatId = msg?.chat?.id;
          const text = (msg?.text ?? "").trim();
          if (!chatId) return new Response("ok");
          if (!isPrivateTelegramChat(msg?.chat?.type) || msg?.from?.id !== chatId) {
            return new Response("ok");
          }

          // Contact shared via "request_contact" button
          if (msg?.contact) {
            if (!isOwnTelegramContact(msg.contact.user_id, msg.from?.id, chatId)) {
              await reply(
                chatId,
                "Xavfsizlik sababli faqat o'zingizning Telegram telefon raqamingizni yuborishingiz mumkin.",
                contactPrompt,
              );
              return new Response("ok");
            }
            const phone = normalizePhone(msg.contact.phone_number);
            if (!phone || phone.length < 7) {
              await reply(chatId, "Telefon raqam noto'g'ri. Qayta urinib ko'ring.", contactPrompt);
              return new Response("ok");
            }
            const phoneLookup = await supabaseAdmin.rpc("telegram_students_by_parent_phone", {
              p_phone: phone,
            });
            const found = phoneLookup.error
              ? (await candidatePool()).filter((student) => phonesOf(student).includes(phone))
              : (phoneLookup.data ?? []);

            if (found.length) {
              await linkAndGreet(chatId, found);
              return new Response("ok");
            }
            await reply(
              chatId,
              "❌ Bu telefon raqam CRMda topilmadi. Administrator telefon raqamingizni tekshirsin yoki sizga bir martalik ulanish havolasini yuborsin.",
              contactPrompt,
            );
            return new Response("ok");
          }

          // Parent asks how to send a receipt
          if (text === MENU_RECEIPT) {
            const students = await linkedStudents(chatId);
            if (!students.length) {
              await askContact(chatId);
              return new Response("ok");
            }
            await reply(
              chatId,
              [
                "🧾 To'lov chekini yuborish",
                "",
                "1) To'lovni amalga oshirasiz (karta, bank yoki naqd).",
                "2) Chek rasmini (screenshot yoki PDF) shu chatga yuborasiz.",
                "3) Rasm izohiga summani yozing — masalan: 450000",
                "",
                "Chek moliya bo'limiga tushadi, administrator tekshirib tasdiqlaydi va sizga darhol xabar keladi.",
              ].join("\n"),
              mainMenu,
            );
            return new Response("ok");
          }

          // Parent sends a payment receipt photo/PDF → finance desk queue
          const receiptFileId = msg?.photo?.length
            ? msg.photo[msg.photo.length - 1]!.file_id
            : msg?.document && /^(image\/|application\/pdf)/.test(msg.document.mime_type ?? "")
              ? msg.document.file_id
              : null;
          if (receiptFileId) {
            const students = await linkedStudents(chatId);
            if (!students.length) {
              await askContact(chatId, "Chekni qabul qilish uchun avval hisobingizni bog'lang.");
              return new Response("ok");
            }
            const {
              storeTelegramReceipt,
              parseDeclaredAmount,
              currentPeriodMonth,
              notifyStaffNewReceipt,
              money,
            } = await import("@/lib/receipts.server");

            const stored = await storeTelegramReceipt(supabaseAdmin as any, receiptFileId);
            if ("error" in stored) {
              await reply(
                chatId,
                `⚠️ Chekni saqlashda xatolik: ${stored.error}\nIltimos, birozdan so'ng qayta yuboring.`,
                mainMenu,
              );
              return new Response("ok");
            }

            const caption = (msg?.caption ?? "").trim();
            const amount = parseDeclaredAmount(caption);
            const student = students[0];
            const studentName =
              `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() || "O'quvchi";

            const { error: insertError } = await supabaseAdmin.from("payment_receipts").insert({
              student_id: student.id,
              parent_chat_id: String(chatId),
              parent_name:
                [msg?.chat?.first_name, msg?.chat?.last_name].filter(Boolean).join(" ") || null,
              declared_amount: amount,
              period_month: currentPeriodMonth(),
              payment_method: "card",
              note: caption || null,
              telegram_file_id: receiptFileId,
              storage_path: stored.path,
              status: "pending",
            });
            if (insertError) {
              await reply(chatId, "⚠️ Chek saqlanmadi. Administrator bilan bog'laning.", mainMenu);
              return new Response("ok");
            }

            await notifyStaffNewReceipt(supabaseAdmin as any, {
              studentName,
              amount,
              note: caption || null,
            });
            await reply(
              chatId,
              [
                "🧾 Chek qabul qilindi!",
                `O'quvchi: ${studentName}`,
                amount ? `Summa: ${money(amount)} so'm` : "Summa: izohda ko'rsatilmagan",
                "",
                "⏳ Moliya bo'limi tekshiradi. Tasdiqlangach sizga darhol xabar yuboraman.",
              ].join("\n"),
              mainMenu,
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
              await reply(
                chatId,
                "Xavfsiz ulanish uchun administrator bergan bir martalik havoladan foydalaning.",
                contactPrompt,
              );
              return new Response("ok");
            }

            // Teacher message / meeting
            if (action === "tch" || action === "meet") {
              const [, teacherId, studentId] = parts;
              const students = await linkedStudents(chatId);
              const student = students.find((s) => s.id === studentId);
              if (!student) {
                await reply(chatId, "❌ O'quvchi topilmadi.");
                return new Response("ok");
              }
              const { data: currentTeachers } = await supabaseAdmin.rpc("teachers_for_student", {
                _student_id: studentId,
              });
              if (!(currentTeachers ?? []).some((row) => row.teacher_id === teacherId)) {
                await reply(
                  chatId,
                  "Bu o'qituvchi hozir o'quvchiga biriktirilmagan. Menyudan qayta tanlang.",
                  mainMenu,
                );
                return new Response("ok");
              }
              const body = action === "meet" ? `📅 Uchrashuv so'rovi: ${text}` : text;
              await supabaseAdmin.from("parent_teacher_messages").insert({
                student_id: studentId,
                teacher_id: teacherId,
                parent_chat_id: String(chatId),
                sender_role: "parent",
                message: body,
                status: "sent",
              });
              await reply(
                chatId,
                "✅ Xabaringiz o'qituvchiga yuborildi. Javob kelganda sizga bildirishnoma yuboraman.",
                mainMenu,
              );
              return new Response("ok");
            }

            // AI free-form question
            if (action === "ai") {
              const studentId = parts[1];
              const students = await linkedStudents(chatId);
              const student = students.find((s) => s.id === studentId) ?? students[0];
              if (!student) {
                await reply(chatId, "❌ O'quvchi topilmadi.", mainMenu);
                return new Response("ok");
              }
              await handleAI(chatId, student, text);
              return new Response("ok");
            }
          }

          // /start [token] — either self-service prompt or legacy token linking
          const startMatch = /^\/start(?:\s+(\S+))?/i.exec(text);
          if (startMatch) {
            const arg = startMatch[1];
            if (!arg) {
              const staff = await linkedStaff(chatId);
              if (staff) {
                await handleStaffCommand(staff, chatId, "/start");
                return new Response("ok");
              }
              const studentAccount = await linkedStudentAccount(chatId);
              if (studentAccount) {
                await handleStudentCommand(studentAccount, chatId, "/start");
                return new Response("ok");
              }
              // Already linked? Show menu directly.
              const existing = await linkedStudents(chatId);
              if (existing.length) {
                await reply(chatId, "Bosh menyu:", mainMenu);
                return new Response("ok");
              }
              await askContact(chatId);
              return new Response("ok");
            }
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              arg,
            );
            if (isUuid || arg.length < 20 || arg.length > 128) {
              await askContact(chatId, "Havola noto'g'ri. ");
              return new Response("ok");
            }
            const tokenHash = await hashTelegramLinkToken(arg);

            // New unified link tokens (student / teacher / admin / director)
            let unifiedStoredToken = tokenHash;
            let { data: uni } = await supabaseAdmin
              .from("telegram_link_tokens")
              .select("token, kind, student_id, user_id, label, expires_at, used_at")
              .eq("token", unifiedStoredToken)
              .maybeSingle();
            // Compatibility with links generated before tokens were hashed at rest.
            if (!uni) {
              unifiedStoredToken = arg;
              const legacy = await supabaseAdmin
                .from("telegram_link_tokens")
                .select("token, kind, student_id, user_id, label, expires_at, used_at")
                .eq("token", unifiedStoredToken)
                .maybeSingle();
              uni = legacy.data;
            }
            if (uni) {
              if (uni.used_at) {
                await askContact(chatId, "Havoladan foydalanilgan. ");
                return new Response("ok");
              }
              if (new Date(uni.expires_at).getTime() < Date.now()) {
                await askContact(chatId, "Havola muddati tugagan. ");
                return new Response("ok");
              }
              const consume = async () => {
                const { data: claimed } = await supabaseAdmin
                  .from("telegram_link_tokens")
                  .update({ used_at: new Date().toISOString(), used_by_chat_id: String(chatId) })
                  .eq("token", unifiedStoredToken)
                  .is("used_at", null)
                  .gt("expires_at", new Date().toISOString())
                  .select("token")
                  .maybeSingle();
                return Boolean(claimed);
              };
              const releaseClaim = async () => {
                await supabaseAdmin
                  .from("telegram_link_tokens")
                  .update({ used_at: null, used_by_chat_id: null })
                  .eq("token", unifiedStoredToken)
                  .eq("used_by_chat_id", String(chatId));
              };

              if (uni.kind === "student") {
                const { data: st } = await supabaseAdmin
                  .from("students")
                  .select("id, first_name, last_name, full_name, telegram_chat_id")
                  .eq("id", uni.student_id!)
                  .maybeSingle();
                if (!st) {
                  await reply(chatId, "❌ O'quvchi topilmadi.");
                  return new Response("ok");
                }
                if (st.telegram_chat_id && st.telegram_chat_id !== String(chatId)) {
                  await reply(
                    chatId,
                    "⚠️ O'quvchi boshqa Telegram akkauntiga biriktirilgan. Ma'muriyatga murojaat qiling.",
                  );
                  return new Response("ok");
                }
                if (!(await consume())) {
                  await askContact(chatId, "Havoladan foydalanilgan yoki muddati tugagan. ");
                  return new Response("ok");
                }
                const { error: linkError } = await supabaseAdmin
                  .from("students")
                  .update({
                    telegram_chat_id: String(chatId),
                    telegram_username: msg?.chat?.username ? `@${msg.chat.username}` : null,
                    telegram_verified_at: new Date().toISOString(),
                    telegram_last_checked_at: new Date().toISOString(),
                    telegram_last_error: null,
                  })
                  .eq("id", st.id);
                if (linkError) {
                  await releaseClaim();
                  await reply(chatId, "Ulanishda xato yuz berdi. Administratorga murojaat qiling.");
                  return new Response("ok");
                }
                await supabaseAdmin.from("telegram_audit_log").insert({
                  subject_kind: "student",
                  subject_id: st.id,
                  action: "link_token",
                  chat_id: String(chatId),
                  success: true,
                });
                const studentName =
                  st.full_name ||
                  `${st.first_name ?? ""} ${st.last_name ?? ""}`.trim() ||
                  "O'quvchi";
                await reply(
                  chatId,
                  `✅ ${studentName} profili Telegramga bog'landi. Dars, davomat va to'lov ma'lumotlaringizni menyudan ko'rishingiz mumkin.`,
                  studentMenu,
                );
                return new Response("ok");
              }
              // Staff link (teacher / admin / director)
              if (!uni.user_id || !["teacher", "admin", "director"].includes(uni.kind)) {
                await reply(chatId, "Ulanish havolasi noto'g'ri.");
                return new Response("ok");
              }
              const { data: actualRoles } = await supabaseAdmin
                .from("user_roles")
                .select("role")
                .eq("user_id", uni.user_id);
              if (!(actualRoles ?? []).some((row) => row.role === uni.kind)) {
                await reply(chatId, "Ulanish roli foydalanuvchi roliga mos emas.");
                return new Response("ok");
              }
              if (!(await consume())) {
                await reply(chatId, "Havoladan foydalanilgan yoki muddati tugagan.");
                return new Response("ok");
              }
              const { error: staffLinkError } = await supabaseAdmin
                .from("staff_telegram_links")
                .upsert(
                  {
                    user_id: uni.user_id!,
                    role: uni.kind,
                    full_name: uni.label,
                    telegram_chat_id: String(chatId),
                    notifications_enabled: true,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "user_id" },
                );
              if (staffLinkError) {
                await releaseClaim();
                await reply(
                  chatId,
                  "Bu Telegram akkaunti boshqa foydalanuvchiga ulangan yoki saqlashda xato yuz berdi.",
                );
                return new Response("ok");
              }
              await supabaseAdmin
                .from("profiles")
                .update({
                  telegram_chat_id: String(chatId),
                  telegram_username: msg?.chat?.username ? `@${msg.chat.username}` : null,
                  telegram_verified_at: new Date().toISOString(),
                  telegram_last_checked_at: new Date().toISOString(),
                  telegram_last_error: null,
                })
                .eq("id", uni.user_id);
              await supabaseAdmin.from("telegram_audit_log").insert({
                subject_kind: "profile",
                subject_id: uni.user_id,
                action: "link_token",
                chat_id: String(chatId),
                success: true,
              });
              if (uni.kind === "director") {
                await supabaseAdmin.from("director_report_recipients").upsert(
                  {
                    user_id: uni.user_id,
                    full_name: uni.label ?? "Direktor",
                    telegram_chat_id: String(chatId),
                    is_active: true,
                  },
                  { onConflict: "telegram_chat_id" },
                );
              }
              await reply(
                chatId,
                `✅ Telegram ID saqlandi (${uni.kind}). Chat ID: ${chatId}\nEndi tizim xabarnomalarini shu chatga olasiz.`,
                staffMenu(uni.kind),
              );
              return new Response("ok");
            }

            let parentStoredToken = tokenHash;
            let { data: linkRow } = await supabaseAdmin
              .from("parent_link_tokens")
              .select("token, student_id, expires_at, used_at")
              .eq("token", parentStoredToken)
              .maybeSingle();
            if (!linkRow) {
              parentStoredToken = arg;
              const legacy = await supabaseAdmin
                .from("parent_link_tokens")
                .select("token, student_id, expires_at, used_at")
                .eq("token", parentStoredToken)
                .maybeSingle();
              linkRow = legacy.data;
            }
            if (!linkRow) {
              await askContact(chatId, "Havola noto'g'ri. ");
              return new Response("ok");
            }
            if (linkRow.used_at) {
              await askContact(chatId, "Havoladan foydalanilgan. ");
              return new Response("ok");
            }
            if (new Date(linkRow.expires_at).getTime() < Date.now()) {
              await askContact(chatId, "Havola muddati tugagan. ");
              return new Response("ok");
            }
            const { data: student } = await supabaseAdmin
              .from("students")
              .select("id, first_name, last_name, parent_telegram_chat_id")
              .eq("id", linkRow.student_id)
              .maybeSingle();
            if (!student) {
              await reply(chatId, "❌ O'quvchi topilmadi.");
              return new Response("ok");
            }
            if (
              student.parent_telegram_chat_id &&
              student.parent_telegram_chat_id !== String(chatId)
            ) {
              await reply(chatId, "⚠️ Boshqa akkaunt biriktirilgan. Ma'muriyatga murojaat qiling.");
              return new Response("ok");
            }
            const { data: claimedParentToken } = await supabaseAdmin
              .from("parent_link_tokens")
              .update({ used_at: new Date().toISOString(), used_by_chat_id: String(chatId) })
              .eq("token", parentStoredToken)
              .is("used_at", null)
              .gt("expires_at", new Date().toISOString())
              .select("token")
              .maybeSingle();
            if (!claimedParentToken) {
              await reply(chatId, "Havoladan foydalanilgan yoki muddati tugagan.");
              return new Response("ok");
            }
            const { error: parentLinkError } = await supabaseAdmin
              .from("students")
              .update({
                parent_telegram_chat_id: String(chatId),
                parent_notifications_enabled: true,
              })
              .eq("id", student.id);
            if (parentLinkError) {
              await supabaseAdmin
                .from("parent_link_tokens")
                .update({ used_at: null, used_by_chat_id: null })
                .eq("token", parentStoredToken)
                .eq("used_by_chat_id", String(chatId));
              await reply(chatId, "Ulanishda xato yuz berdi. Administratorga murojaat qiling.");
              return new Response("ok");
            }
            await supabaseAdmin.from("telegram_audit_log").insert({
              subject_kind: "parent",
              subject_id: student.id,
              action: "link_token",
              chat_id: String(chatId),
              success: true,
            });
            await reply(
              chatId,
              `✅ Bog'landi. Endi ${student.first_name} ${student.last_name ?? ""} bo'yicha bildirishnomalarni olasiz.`,
              mainMenu,
            );
            return new Response("ok");
          }
          const staff = await linkedStaff(chatId);
          if (staff) {
            if (!(await handleStaffCommand(staff, chatId, text))) {
              await reply(
                chatId,
                "Xodim menyusidan kerakli bo'limni tanlang.",
                staffMenu(staff.role),
              );
            }
            return new Response("ok");
          }

          const studentAccount = await linkedStudentAccount(chatId);
          if (studentAccount) {
            if (!(await handleStudentCommand(studentAccount, chatId, text))) {
              await reply(chatId, "O'quvchi menyusidan kerakli bo'limni tanlang.", studentMenu);
            }
            return new Response("ok");
          }

          // Menu handlers — require linked account
          const students = await linkedStudents(chatId);
          if (!students.length) {
            await askContact(chatId);
            return new Response("ok");
          }

          const pickStudent = async (action: string, prompt: string) => {
            if (students.length === 1) return handleAction(action, students[0], chatId);
            await reply(chatId, prompt, {
              reply_markup: {
                inline_keyboard: students.map((s) => [
                  {
                    text: `${s.first_name} ${s.last_name ?? ""}`.trim(),
                    callback_data: `pick:${s.id}:${action}`,
                  },
                ]),
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
          if (text === MENU_PAYMENT) return pickStudent("payment", "Qaysi farzand uchun?");
          if (text === MENU_STATS) return pickStudent("stats", "Qaysi farzand uchun?");
          if (text === MENU_AI)
            return pickStudent("ai_prompt", "Qaysi farzand haqida so'ramoqchisiz?");

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
            student: {
              id: string;
              first_name: string | null;
              last_name: string | null;
              group_id: string | null;
            },
            chat: number,
          ) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const fullName = `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim();

            if (action === "ai_prompt") {
              const marker = `${ZWJ}ai|${student.id}${ZWJ}`;
              await reply(
                chat,
                `${marker}\n🤖 ${fullName} haqida savolingizni yozing (masalan: "Qancha to'lov qoldi?" yoki "Bu haftadagi davomati qanday?"). Shu xabarga JAVOB (reply) qilib yozing.`,
                { reply_markup: { force_reply: true, selective: true } },
              );
              return new Response("ok");
            }

            if (action === "teacher" || action === "meeting") {
              const { data: teachers } = await supabaseAdmin.rpc("teachers_for_student", {
                _student_id: student.id,
              });
              const list = (teachers ?? []) as {
                teacher_id: string;
                subject_name: string | null;
                group_name: string | null;
              }[];
              if (!list.length) {
                await reply(chat, "O'qituvchi topilmadi.");
                return new Response("ok");
              }
              const ids = Array.from(new Set(list.map((t) => t.teacher_id)));
              const { data: profs } = await supabaseAdmin
                .from("profiles")
                .select("id, full_name")
                .in("id", ids);
              const nameOf: Record<string, string> = Object.fromEntries(
                (profs ?? []).map((p) => [p.id, p.full_name ?? "O'qituvchi"]),
              );
              const prefix = action === "meeting" ? "meet" : "tch";
              await reply(chat, `${fullName} — o'qituvchini tanlang:`, {
                reply_markup: {
                  inline_keyboard: list.slice(0, 20).map((t) => [
                    {
                      text: `${nameOf[t.teacher_id] ?? "O'qituvchi"} — ${t.subject_name ?? t.group_name ?? ""}`,
                      callback_data: makeTeacherCallback(prefix, t.teacher_id, student.id),
                    },
                  ]),
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
              await supabaseAdmin
                .from("parent_teacher_messages")
                .update({ read_at: new Date().toISOString(), status: "read" })
                .eq("student_id", student.id)
                .eq("sender_role", "teacher")
                .is("read_at", null);
              const lines = rows.reverse().map((m) => {
                const who = m.sender_role === "teacher" ? "👨‍🏫 O'qituvchi" : "👨‍👩‍👧 Siz";
                const t = new Date(m.created_at).toLocaleString("uz-UZ", {
                  hour12: false,
                  timeZone: "Asia/Tashkent",
                });
                return `${who} (${t}):\n${m.message}`;
              });
              await reply(chat, `📜 Oxirgi yozishmalar:\n\n${lines.join("\n\n")}`);
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
              .select("amount, total_amount, period_month, status, paid_at")
              .eq("student_id", studentId)
              .order("period_month", { ascending: false })
              .limit(12);
            if (!pays || pays.length === 0) return "To'lovlar topilmadi.";
            const monthKey = `${tashkentDay().date.slice(0, 7)}-01`;
            const totalDebt = pays
              .filter((p) => p.status !== "paid" && p.period_month <= monthKey)
              .reduce((s, p) => s + Number(p.total_amount || p.amount || 0), 0);
            const lastPaid = pays.find((p) => p.status === "paid");
            const nextDue = pays.filter((p) => p.status !== "paid").slice(-1)[0];
            const lines = [
              `💳 To'lov holati — ${fullName}`,
              `Qarzdorlik: ${totalDebt.toLocaleString()} so'm`,
              lastPaid
                ? `Oxirgi to'lov: ${new Date(
                    lastPaid.paid_at ?? lastPaid.period_month,
                  ).toLocaleDateString("uz-UZ", { timeZone: "Asia/Tashkent" })}`
                : "Oxirgi to'lov: —",
              nextDue
                ? `Keyingi muddat: ${String(nextDue.period_month).slice(0, 7)}`
                : "Keyingi muddat: —",
              "",
              "So'nggi to'lovlar:",
              ...pays
                .slice(0, 6)
                .map(
                  (p) =>
                    `• ${String(p.period_month).slice(0, 7)}: ${Number(p.total_amount || p.amount).toLocaleString()} so'm — ${p.status === "paid" ? "✅ to'langan" : "⏳ kutilmoqda"}`,
                ),
            ];
            return lines.join("\n");
          }

          async function statsSummary(studentId: string, fullName: string): Promise<string> {
            const from = new Date();
            from.setDate(from.getDate() - 30);
            const fromDate = new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Tashkent",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(from);
            const { data: att } = await supabaseAdmin
              .from("attendance")
              .select("status")
              .eq("student_id", studentId)
              .gte("date", fromDate);
            const present = (att ?? []).filter((a) => a.status === "present").length;
            const absent = (att ?? []).filter((a) => a.status === "absent").length;
            const late = (att ?? []).filter((a) => a.status === "late").length;
            const lines = [
              `📊 Statistika — ${fullName} (30 kun)`,
              `Davomat: ✅ ${present} · ❌ ${absent} · ⏰ ${late}`,
            ];
            return lines.join("\n");
          }

          async function handleAI(
            chat: number,
            student: {
              id: string;
              first_name: string | null;
              last_name: string | null;
              group_id: string | null;
            },
            question: string,
          ) {
            const fullName = `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim();
            const [pay, stat] = await Promise.all([
              paymentSummary(student.id, fullName),
              statsSummary(student.id, fullName),
            ]);
            const apiKey = process.env.LOVABLE_API_KEY;
            const aiEnabled = process.env.TELEGRAM_AI_ENABLED === "true";
            if (!apiKey || !aiEnabled) {
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
                    { role: "user", content: question.slice(0, 1000) },
                  ],
                }),
                signal: AbortSignal.timeout(8_000),
              });
              if (!r.ok) throw new Error(`AI HTTP ${r.status}`);
              const j = (await r.json().catch(() => ({}))) as {
                choices?: Array<{ message?: { content?: string } }>;
              };
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
        };

        try {
          const response = await processUpdate();
          if (trackedUpdateId !== null) {
            await supabaseAdmin.rpc("finish_telegram_update", {
              p_update_id: trackedUpdateId,
              p_success: true,
              p_error: "",
            });
          }
          return response;
        } catch (error: unknown) {
          if (trackedUpdateId !== null) {
            await supabaseAdmin.rpc("finish_telegram_update", {
              p_update_id: trackedUpdateId,
              p_success: false,
              p_error: error instanceof Error ? error.message : "Noma'lum webhook xatosi",
            });
          }
          throw error;
        }
      },
    },
  },
});
