import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MessageSquare, Pencil, RefreshCcw, Send, Trash2, UserPlus, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { STATUS_META, STATUS_ORDER, type StudentStatus } from "@/lib/status";
import { TelegramIdField } from "@/components/TelegramIdField";
import { MethodologyLibrary } from "@/components/MethodologyLibrary";
import { LowIncomeBadge } from "@/components/LowIncomeBadge";
import { StudentFeeEditor } from "@/components/StudentFeeEditor";


const DAYS_UZ = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type StudentRow = {
  id: string;
  monthly_fee: number | null;
  status_enum: StudentStatus | null;
  enrolled_at: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  parent_full_name: string | null;
  parent_phone: string | null;
  parent_telegram_chat_id: string | null;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  telegram_verified_at: string | null;
  telegram_last_checked_at: string | null;
  telegram_last_error: string | null;
  notes: string | null;
  low_income: boolean | null;
  low_income_note: string | null;
  profile: { id: string; full_name: string | null; phone: string | null } | null;
};

type Group = { id: string; name: string; monthly_fee: number; subject_id: string | null; teacher_id: string | null };
type Enrollment = {
  id: string;
  group_id: string;
  subject_id: string | null;
  teacher_user_id: string | null;
  started_at: string;
  monthly_fee: number | null;
  status: string;
  group: { id: string; name: string; monthly_fee: number; subject: { name: string } | null; teacher: { full_name: string | null } | null } | null;
};
type LessonRow = { group_id: string; day_of_week: number; start_time: string; end_time: string };
type PaymentRow = { id: string; amount: number; period_month: string; status: string; paid_at: string | null; note: string | null };
type AttendanceRow = { id: string; date: string; status: string; note: string | null };
const ATT_META: Record<string, { label: string; cls: string }> = {
  present: { label: "Keldi", cls: "bg-emerald-500/15 text-emerald-400" },
  late: { label: "Kechikdi", cls: "bg-amber-500/15 text-amber-400" },
  absent: { label: "Kelmadi", cls: "bg-destructive/15 text-destructive" },
  excused: { label: "Sababli", cls: "bg-sky-500/15 text-sky-400" },
};

export const Route = createFileRoute("/_authenticated/students_/$id")({
  head: () => ({ meta: [
    { title: "O‘quvchi va oylik to‘lov | Akhmad Academy" },
    { name: "description", content: "Akhmad Academy o‘quvchisining guruhlari, oylik to‘lovi va davomati." },
    { property: "og:title", content: "O‘quvchi | Akhmad Academy" },
    { property: "og:description", content: "O‘quvchi ma’lumotlari va individual oylik to‘lovlar." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: StudentProfile,
});

function StudentProfile() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<"pay" | "refund" | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);
  const [tgLink, setTgLink] = useState<{ link: string | null; token: string; expires_at: string } | null>(null);
  const [tgLoading, setTgLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: enr }, { data: pays }, { data: gs }, { data: att }] = await Promise.all([
      supabase.from("students").select(`
        id, monthly_fee, status_enum, enrolled_at, full_name, first_name, last_name, parent_full_name, parent_phone, parent_telegram_chat_id, notes, low_income, low_income_note,
        telegram_chat_id, telegram_username, telegram_verified_at, telegram_last_checked_at, telegram_last_error,
        profile:profiles(id, full_name, phone)
      `).eq("id", id).maybeSingle(),
      supabase.from("student_enrollments").select(`
        id, group_id, subject_id, teacher_user_id, started_at, monthly_fee, status,
        group:groups(id, name, monthly_fee, teacher_id, subject:subjects(name))
      `).eq("student_id", id).order("started_at", { ascending: false }),
      supabase.from("payments").select("id, amount, period_month, status, paid_at, note").eq("student_id", id).order("period_month", { ascending: false }),
      supabase.from("groups").select("id, name, monthly_fee, subject_id, teacher_id").order("name"),
      supabase.from("attendance").select("id, date, status, note").eq("student_id", id).order("date", { ascending: false }).limit(120),
    ]);
    setAttendance((att as never) ?? []);
    setStudent((s as never) ?? null);
    const enrolls = ((enr as never) ?? []) as Enrollment[];
    // groups.teacher_id auth.users ga qaraydi — ismlarni profiles dan alohida olamiz
    const tIds = [...new Set(enrolls.map((e: any) => e.group?.teacher_id).filter(Boolean))];
    if (tIds.length) {
      const { data: tprofs } = await supabase.from("profiles").select("id, full_name").in("id", tIds);
      const names = new Map((tprofs ?? []).map((p: any) => [p.id, p.full_name ?? ""]));
      enrolls.forEach((e: any) => {
        if (e.group) e.group.teacher = { full_name: names.get(e.group.teacher_id) ?? null };
      });
    }
    setEnrollments(enrolls);
    setPayments((pays as never) ?? []);
    setGroups((gs as never) ?? []);

    const groupIds = enrolls.map((e) => e.group_id);
    if (groupIds.length) {
      const { data: l } = await supabase.from("lessons").select("group_id, day_of_week, start_time, end_time").in("group_id", groupIds).eq("is_active", true);
      setLessons((l as never) ?? []);
    } else {
      setLessons([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const totalMonthlyFee = useMemo(
    () => enrollments.some((e) => e.status === "active")
      ? enrollments.filter((e) => e.status === "active").reduce((sum, e) => sum + Number(e.monthly_fee ?? e.group?.monthly_fee ?? 0), 0)
      : Number(student?.monthly_fee ?? 0),
    [enrollments, student],
  );

  const balance = useMemo(() => {
    let paid = 0, refunded = 0;
    payments.forEach((p) => {
      if (p.status === "paid") paid += Number(p.amount);
      if (p.status === "refunded") refunded += Number(p.amount);
    });
    return paid - refunded;
  }, [payments]);

  const lessonDaysSet = useMemo(() => new Set(lessons.map((l) => l.day_of_week % 7)), [lessons]);
  const attStats = useMemo(() => {
    const counts: Record<string, number> = {};
    attendance.forEach((a) => { counts[a.status] = (counts[a.status] ?? 0) + 1; });
    const total = attendance.length;
    const attended = (counts.present ?? 0) + (counts.late ?? 0);
    return { counts, total, percent: total ? Math.round((attended / total) * 100) : null };
  }, [attendance]);
  const lastPaid = useMemo(
    () => payments.filter((p) => p.status === "paid" && p.paid_at).sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""))[0] ?? null,
    [payments],
  );
  const monthCalendar = useMemo(() => buildMonth(new Date()), []);

  if (loading) return <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">Yuklanmoqda...</div>;
  if (!student) return <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">O'quvchi topilmadi</div>;

  const status = (student.status_enum ?? "active") as StudentStatus;
  const meta = STATUS_META[status];
  const studentName =
    student.full_name?.trim() ||
    [student.last_name, student.first_name].filter(Boolean).join(" ").trim() ||
    student.profile?.full_name?.trim() ||
    "Ismsiz o'quvchi";
  const initials = (studentName || "??").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const changeStatus = async (v: StudentStatus) => {
    await supabase.from("students").update({ status_enum: v }).eq("id", id);
    await supabase.from("student_status_history").insert({ student_id: id, from_status: student.status_enum ?? undefined, to_status: v });
    load();
  };

  const sendTelegram = async () => {
    const text = prompt("Ota-onaga yuboriladigan xabar:");
    if (!text) return;
    try {
      const { sendParentTelegram } = await import("@/lib/notifications.functions");
      const res = await sendParentTelegram({ data: { student_id: id, text, kind: "manual" } });
      if ((res as { ok?: boolean })?.ok) toast.success("Yuborildi"); else toast.error("Yuborilmadi");
    } catch (e) { toast.error((e as Error)?.message ?? "Xato"); }
  };

  const removeEnrollment = async (enrollmentId: string) => {
    if (!confirm("Bu guruhdan chiqarilsinmi?")) return;
    const { error } = await supabase.from("student_enrollments").delete().eq("id", enrollmentId);
    if (error) return toast.error(error.message);
    toast.success("O'chirildi");
    load();
  };

  const generateTgLink = async () => {
    setTgLoading(true);
    try {
      const { createParentLinkToken } = await import("@/lib/telegram-admin.functions");
      const res = await createParentLinkToken({ data: { studentId: id, ttlMinutes: 60 * 24 * 7 } });
      setTgLink(res);
      if (res.link) {
        try { await navigator.clipboard.writeText(res.link); toast.success("Havola nusxalandi"); } catch { toast.success("Havola yaratildi"); }
      } else toast.success("Token yaratildi");
    } catch (e) { toast.error((e as Error)?.message ?? "Xato"); }
    setTgLoading(false);
  };

  const setLowIncome = async (value: boolean) => {
    const { error } = await supabase
      .from("students")
      .update({ low_income: value, low_income_note: value ? student?.low_income_note ?? null : null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(value ? "Kam ta'minlangan deb belgilandi" : "Belgi olib tashlandi");
    load();
  };

  const editLowIncomeNote = async () => {
    const note = prompt("Qisqa izoh (masalan: mahalla ma'lumotnomasi bor)", student?.low_income_note ?? "");
    if (note === null) return;
    const { error } = await supabase
      .from("students")
      .update({ low_income_note: note.trim() || null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate({ to: "/students" })} className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary/50">
          <ArrowLeft className="h-3.5 w-3.5" /> Ro'yxatga
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Balans</div>
          <div className={`mt-1 text-xl font-extrabold ${balance - totalMonthlyFee < 0 ? "text-destructive" : "text-emerald-400"}`}>{balance.toLocaleString("uz-UZ")} so‘m</div>
          <div className="text-[11px] text-muted-foreground">Oylik: {totalMonthlyFee.toLocaleString("uz-UZ")} so‘m</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Davomat</div>
          <div className="mt-1 text-xl font-extrabold text-primary">{attStats.percent === null ? "—" : `${attStats.percent}%`}</div>
          <div className="text-[11px] text-muted-foreground">{attStats.total} ta dars belgilangan</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Guruhlar</div>
          <div className="mt-1 text-xl font-extrabold">{enrollments.filter((e) => e.status === "active" || e.status === "trial").length}</div>
          <div className="text-[11px] text-muted-foreground">faol guruh</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Oxirgi to‘lov</div>
          <div className="mt-1 text-xl font-extrabold">{lastPaid ? `${Number(lastPaid.amount).toLocaleString("uz-UZ")} so‘m` : "—"}</div>
          <div className="text-[11px] text-muted-foreground">{lastPaid?.paid_at ? new Date(lastPaid.paid_at).toLocaleDateString("uz-UZ") : "To‘lov yo‘q"}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT: identity + actions */}
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-2xl font-extrabold text-primary">{initials}</div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-extrabold tracking-tight">{studentName}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">ID: {student.id.slice(0, 8)}</span>
                {student.low_income && <LowIncomeBadge note={student.low_income_note} />}
              </div>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Telefon raqam</div>
              <div className="font-bold">{student.profile?.phone || "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Ilova holati</div>
              <div className="font-semibold">{student.parent_telegram_chat_id ? "Faol" : "Ilova ishlatmaydi"}</div>
            </div>
          </div>

          <TelegramIdField
            kind="student"
            subjectId={student.id}
            title="O'quvchining Telegram ID"
            initial={{
              chat_id: student.telegram_chat_id,
              username: student.telegram_username,
              verified_at: student.telegram_verified_at,
              last_checked_at: student.telegram_last_checked_at,
              last_error: student.telegram_last_error,
            }}
          />

          <div className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={!!student.low_income}
                onChange={(e) => void setLowIncome(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span className="min-w-0">
                <span className="block text-xs font-bold">Kam ta'minlangan oila reyestrida</span>
                <span className="block text-[11px] text-muted-foreground">
                  Belgilansa, o'quvchi guruh va umumiy ro'yxatlarda alohida rangli belgi bilan
                  ko'rinadi.
                </span>
              </span>
            </label>
            {student.low_income && (
              <button
                onClick={() => void editLowIncomeNote()}
                className="mt-2 text-[11px] font-bold text-amber-700 underline"
              >
                {student.low_income_note ? `Izoh: ${student.low_income_note}` : "Izoh qo'shish"}
              </button>
            )}
          </div>

          <div className="space-y-2 pt-2">
            <button onClick={() => setNoteOpen(true)} className="w-full rounded-lg border border-primary/40 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary/5">
              O'quvchiga qo'shimcha ma'lumot qo'shish
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setAssignOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold uppercase text-primary-foreground">
                <Users className="h-3.5 w-3.5" /> Guruhlarni boshqarish
              </button>
              <button onClick={() => setPayOpen("pay")} className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/40 px-3 py-2.5 text-xs font-semibold uppercase text-primary hover:bg-primary/5">
                <Wallet className="h-3.5 w-3.5" /> To'lov qilish
              </button>
            </div>
            <button onClick={() => setPayOpen("refund")} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/40 px-3 py-2.5 text-xs font-semibold uppercase text-destructive hover:bg-destructive/5">
              <RefreshCcw className="h-3.5 w-3.5" /> Pul qaytarish
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={sendTelegram} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-xs font-semibold hover:border-primary/50" title="Ota-onaga xabar">
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setParentOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-xs font-semibold hover:border-primary/50" title="Ota-ona tahrirlash">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            <button onClick={generateTgLink} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:border-primary/50">
              <Send className="h-3 w-3" /> {tgLoading ? "..." : "Telegram havola yaratish"}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2">
            <span className="text-xs uppercase text-muted-foreground">Holati</span>
            <select
              value={status}
              onChange={(e) => changeStatus(e.target.value as StudentStatus)}
              className={`rounded-lg border-transparent px-3 py-1.5 text-xs font-semibold ${meta.tint}`}
            >
              {STATUS_ORDER.map((k) => <option key={k} value={k}>{STATUS_META[k].label}</option>)}
            </select>
          </div>

          {tgLink && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
              <div className="mb-1 font-bold text-primary">Ota-ona uchun havola (7 kun amal qiladi)</div>
              {tgLink.link ? (
                <a href={tgLink.link} target="_blank" rel="noreferrer" className="break-all font-mono text-primary underline">{tgLink.link}</a>
              ) : (
                <div className="break-all font-mono">Token: {tgLink.token}</div>
              )}
              <button
                onClick={() => { if (tgLink.link) { navigator.clipboard.writeText(tgLink.link).then(() => toast.success("Nusxalandi")); } }}
                className="mt-2 rounded-md border border-border bg-background px-2 py-1 text-[11px]"
              >Nusxalash</button>
            </div>
          )}
        </div>

        {/* RIGHT: per-enrollment cards */}
        <div className="space-y-5">
          {!enrollments.some((e) => e.status === "active") && <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold">Oylik: {Number(student.monthly_fee ?? 0).toLocaleString("uz-UZ")} so‘m</span>
            <StudentFeeEditor studentId={id} amount={Number(student.monthly_fee ?? 0)} label={studentName} onSaved={load} />
          </div>}
          {enrollments.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Hech qaysi guruhga yozilmagan</p>
              <button onClick={() => setAssignOpen(true)} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
                <UserPlus className="h-3.5 w-3.5" /> Guruhlarni boshqarish
              </button>
            </div>
          )}
          {enrollments.map((e) => {
            const grpLessons = lessons.filter((l) => l.group_id === e.group_id);
            const fee = Number(e.monthly_fee ?? e.group?.monthly_fee ?? 0);
            const paidForGroup = payments
              .filter((p) => p.status === "paid" && (p.note ?? "").includes(e.group?.name ?? "___"))
              .reduce((s, p) => s + Number(p.amount), 0);
            const groupBalance = paidForGroup - fee;
            const start = new Date(e.started_at);
            const endGuess = new Date(start); endGuess.setMonth(endGuess.getMonth() + 6);
            const nextPay = new Date(); nextPay.setMonth(nextPay.getMonth() + 1); nextPay.setDate(1);
            const grpDays = new Set(grpLessons.map((l) => l.day_of_week % 7));
            return (
              <div key={e.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                {/* header */}
                <div className="flex items-center justify-between gap-2 bg-primary/90 px-4 py-3 text-primary-foreground">
                  <div className="inline-flex items-center gap-2 rounded-md bg-emerald-500/20 px-2.5 py-1 text-sm font-extrabold">
                    <Wallet className="h-4 w-4" />
                    {groupBalance >= 0 ? "+" : ""}{groupBalance.toLocaleString()} so'm
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-md px-3 py-1 text-xs font-bold ${STATUS_META[status].tint}`}>{STATUS_META[status].label}</span>
                    <button
                      onClick={() => removeEnrollment(e.id)}
                      className="grid h-8 w-8 place-items-center rounded-md hover:bg-white/10"
                      title="Guruhdan chiqarish"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-extrabold uppercase leading-tight tracking-wide">{e.group?.subject?.name || e.group?.name || "—"}</h3>
                  </div>
                  {e.status === "active" && <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold">Oylik: {fee.toLocaleString("uz-UZ")} so‘m</span>
                    <StudentFeeEditor studentId={id} enrollmentId={e.id} amount={fee} label={`${studentName} · ${e.group?.name ?? "Guruh"}`} onSaved={load} />
                  </div>}

                  <div className="text-xs">
                    <span className="text-muted-foreground">Guruh intervali : </span>
                    <span className="font-semibold">{fmtDate(start)}/{fmtDate(endGuess)}</span>
                  </div>

                  <div className="inline-flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold">{e.group?.teacher?.full_name || "—"}</span>
                  </div>

                  {grpLessons.length > 0 && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Dars vaqti : </span>
                      <span className="font-semibold">{grpLessons[0].start_time.slice(0, 5)}–{grpLessons[0].end_time.slice(0, 5)}</span>
                    </div>
                  )}

                  <div>
                    <div className="mb-1.5 text-xs text-muted-foreground">Dars kunlari :</div>
                    <div className="flex flex-wrap gap-1.5">
                      {grpLessons.map((l, i) => (
                        <span key={i} className="rounded-md bg-secondary/60 px-2.5 py-0.5 text-xs font-semibold">{DAYS_UZ[l.day_of_week % 7]}</span>
                      ))}
                      {grpLessons.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Boshlangan sana</div>
                      <div className="font-semibold">📅 {fmtDate(start)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">O'chiriladigan sana</div>
                      <div className="font-semibold">📅 {fmtDate(endGuess)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Keyingi to'lov</div>
                      <div className="font-semibold">⏰ {fmtDate(nextPay)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">To'lov narxi</div>
                      <div className="font-bold text-primary">{fee.toLocaleString()} so'm</div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-3">
                    <div className="mb-2 text-center text-sm font-bold">Darslar taqvimi ({monthCalendar.label})</div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {monthCalendar.days.map((d, i) => {
                        if (!d) return <div key={i} />;
                        const isLessonDay = grpDays.has(d.dow);
                        const isToday = d.isToday;
                        return (
                          <div
                            key={i}
                            className={`flex aspect-square items-center justify-center rounded-md text-xs font-bold ${
                              isLessonDay ? "bg-destructive text-destructive-foreground" : "bg-secondary/40 text-foreground/60"
                            } ${isToday ? "ring-2 ring-primary" : ""}`}
                          >
                            {String(d.n).padStart(2, "0")}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex flex-wrap justify-center gap-3 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> To'langan</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-destructive" /> Qarzdor</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-secondary" /> Kutilayotgan</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Attendance history */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">Davomat tarixi</h3>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {Object.entries(ATT_META).map(([k, m]) => (
              <span key={k} className={`rounded-full px-2 py-0.5 font-semibold ${m.cls}`}>{m.label}: {attStats.counts[k] ?? 0}</span>
            ))}
          </div>
        </div>
        {attendance.length === 0 ? (
          <p className="text-sm text-muted-foreground">Davomat hali belgilanmagan</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {attendance.slice(0, 60).map((a) => {
              const m = ATT_META[a.status] ?? { label: a.status, cls: "bg-muted text-muted-foreground" };
              return (
                <span key={a.id} title={a.note ?? m.label} className={`rounded-md px-2 py-1 text-[11px] font-semibold ${m.cls}`}>
                  {a.date.slice(5).split("-").reverse().join(".")} · {m.label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Payments history */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-3 font-bold">To'lovlar tarixi</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Yozuv yo'q</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-2">Oy</th><th>Summa</th><th>Status</th><th>Sana</th><th>Izoh</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2">{p.period_month.slice(0, 7)}</td>
                    <td>{Number(p.amount).toLocaleString()} so'm</td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        p.status === "paid" ? "bg-emerald-500/15 text-emerald-600" :
                        p.status === "refunded" ? "bg-blue-500/15 text-blue-600" :
                        "bg-destructive/15 text-destructive"
                      }`}>{p.status}</span>
                    </td>
                    <td className="text-xs text-muted-foreground">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}</td>
                    <td className="text-xs text-muted-foreground">{p.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Metodika: o'quvchining fanlari bo'yicha */}
      <MethodologyLibrary
        compact
        subjects={enrollments
          .map((e) => e.group?.subject?.name || e.group?.name || "")
          .filter(Boolean)}
        title="Metodika (o'quvchi fanlari bo'yicha)"
      />



      {assignOpen && (
        <GroupManageModal
          studentId={id}
          enrollments={enrollments}
          groups={groups}
          onClose={() => setAssignOpen(false)}
          onSaved={() => { setAssignOpen(false); load(); }}
        />
      )}
      {payOpen && (
        <PaymentModal
          mode={payOpen}
          defaultAmount={totalMonthlyFee}
          onClose={() => setPayOpen(null)}
          onSaved={() => { setPayOpen(null); load(); }}
          studentId={id}
        />
      )}
      {noteOpen && (
        <NotesModal
          initial={student.notes ?? ""}
          onClose={() => setNoteOpen(false)}
          onSaved={() => { setNoteOpen(false); load(); }}
          studentId={id}
        />
      )}
      {parentOpen && (
        <ParentEditModal
          studentId={id}
          initial={{
            parent_full_name: student.parent_full_name ?? "",
            parent_phone: student.parent_phone ?? "",
            parent_telegram_chat_id: student.parent_telegram_chat_id ?? "",
          }}
          onClose={() => setParentOpen(false)}
          onSaved={() => { setParentOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/50 py-1.5 last:border-0">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

function ActionBtn({ children, onClick, icon: Icon, primary }: { children: React.ReactNode; onClick: () => void; icon: React.ComponentType<{ className?: string }>; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold ${
        primary ? "bg-primary text-primary-foreground" : "border border-border bg-background hover:border-primary/50"
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

function buildMonth(now: Date) {
  const y = now.getFullYear(), m = now.getMonth();
  const first = new Date(y, m, 1);
  const startDow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = now.getDate();
  const days: (null | { n: number; dow: number; isToday: boolean })[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(y, m, d).getDay();
    days.push({ n: d, dow, isToday: d === today });
  }
  return { days, label: now.toLocaleDateString("uz-UZ", { month: "long", year: "numeric" }) };
}

function GroupManageModal({ studentId, enrollments, groups, onClose, onSaved }: { studentId: string; enrollments: Enrollment[]; groups: Group[]; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [swapGid, setSwapGid] = useState("");
  const [newGid, setNewGid] = useState("");
  const [error, setError] = useState("");

  const active = enrollments.filter((e) => e.status === "active" || e.status === "trial");
  const activeIds = active.map((e) => e.group_id);
  const available = groups.filter((g) => !activeIds.includes(g.id));
  const endedDate = new Date().toISOString().slice(0, 10);

  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await task(); }
    catch (err) { setError(err instanceof Error ? err.message : (err as { message?: string }).message ?? "Saqlanmadi"); }
    finally { setBusy(false); }
  };

  const endEnrollment = (enrollmentId: string) =>
    run(async () => {
      if (!window.confirm("O'quvchini guruhdan chiqaramizmi? Eski to'lovlar va davomat saqlanadi.")) return;
      const { error: err } = await supabase.from("student_enrollments").update({ status: "ended", ended_at: endedDate }).eq("id", enrollmentId);
      if (err) throw err;
      toast.success("Guruhdan chiqarildi");
      onSaved();
    });

  const addTo = (gid: string) =>
    run(async () => {
      const g = groups.find((x) => x.id === gid);
      const { error: err } = await supabase.from("student_enrollments").insert({
        student_id: studentId,
        group_id: gid,
        subject_id: g?.subject_id ?? null,
        teacher_user_id: g?.teacher_id ?? null,
        monthly_fee: g?.monthly_fee ?? null,
        status: "active",
        ended_at: null,
      });
      if (err) throw err;
      toast.success("Yangi guruhga qo'shildi");
      onSaved();
    });

  const swap = (enrollmentId: string, toGid: string) =>
    run(async () => {
      const g = groups.find((x) => x.id === toGid);
      const { error: endErr } = await supabase.from("student_enrollments").update({ status: "ended", ended_at: endedDate }).eq("id", enrollmentId);
      if (endErr) throw endErr;
      const { error: insErr } = await supabase.from("student_enrollments").insert({
        student_id: studentId,
        group_id: toGid,
        subject_id: g?.subject_id ?? null,
        teacher_user_id: g?.teacher_id ?? null,
        monthly_fee: g?.monthly_fee ?? null,
        status: "active",
        ended_at: null,
      });
      if (insErr) throw insErr;
      toast.success("Guruh almashtirildi");
      onSaved();
    });

  return (
    <Modal title="Guruhlarni boshqarish" onClose={onClose}>
      <div className="max-h-[60dvh] space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Joriy guruhlar</h3>
          {active.length === 0 && <p className="text-sm text-muted-foreground">Hech qaysi guruhda emas.</p>}
          {active.map((e) => {
            const g = groups.find((x) => x.id === e.group_id);
            return (
              <div key={e.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{g?.name ?? e.group?.name ?? "Guruh"}</div>
                    <div className="text-xs text-muted-foreground">
                      {Number(e.monthly_fee ?? g?.monthly_fee ?? 0).toLocaleString("uz-UZ")} so'm/oy
                      {e.group?.subject?.name ? ` · ${e.group.subject.name}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={busy || available.length === 0}
                      onClick={() => { setSwapFor(swapFor === e.id ? null : e.id); setSwapGid(""); }}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:border-primary/50 disabled:opacity-50"
                    >Almashtirish</button>
                    <button
                      disabled={busy}
                      onClick={() => endEnrollment(e.id)}
                      className="rounded-lg border border-destructive/40 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50"
                    >Chiqarish</button>
                  </div>
                </div>
                {swapFor === e.id && (
                  <div className="mt-3 space-y-2">
                    <select value={swapGid} onChange={(ev) => setSwapGid(ev.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                      <option value="">— Yangi guruh tanlang —</option>
                      {available.map((g2) => <option key={g2.id} value={g2.id}>{g2.name} — {Number(g2.monthly_fee).toLocaleString()} so'm/oy</option>)}
                    </select>
                    <button
                      disabled={busy || !swapGid}
                      onClick={() => swap(e.id, swapGid)}
                      className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                    >Almashtirish</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="space-y-2 border-t border-border pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Yangi guruhga qo'shish</h3>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">Barcha guruhlarga yozilgan. Yangi guruh yarating.</p>
          ) : (
            <>
              <select value={newGid} onChange={(ev) => setNewGid(ev.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                <option value="">— Guruh tanlang —</option>
                {available.map((g) => <option key={g.id} value={g.id}>{g.name} — {Number(g.monthly_fee).toLocaleString()} so'm/oy</option>)}
              </select>
              <button
                disabled={busy || !newGid}
                onClick={() => addTo(newGid)}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >Qo'shish</button>
            </>
          )}
        </div>
      </div>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    </Modal>
  );
}

function PaymentModal({ studentId, mode, defaultAmount, onClose, onSaved }: { studentId: string; mode: "pay" | "refund"; defaultAmount: number; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(String(defaultAmount || ""));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const isRefund = mode === "refund";
  return (
    <Modal title={isRefund ? "Pul qaytarish" : "To'lov qilish"} onClose={onClose}>
      <label className="block text-sm">
        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Summa (so'm)</div>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
      </label>
      <label className="block text-sm">
        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Izoh</div>
        <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
      </label>
      <button
        disabled={saving || !amount}
        onClick={async () => {
          setSaving(true);
          const now = new Date();
          const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
          const { error } = await supabase.from("payments").insert({
            student_id: studentId,
            amount: Number(amount),
            period_month: period,
            status: isRefund ? "refunded" : "paid",
            paid_at: new Date().toISOString(),
            note: note || (isRefund ? "Qaytarildi" : "Qo'lda to'landi"),
          });
          if (error) toast.error(error.message); else { toast.success("Saqlandi"); onSaved(); }
          setSaving(false);
        }}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >Saqlash</button>
    </Modal>
  );
}

function NotesModal({ studentId, initial, onClose, onSaved }: { studentId: string; initial: string; onClose: () => void; onSaved: () => void }) {
  const [txt, setTxt] = useState(initial);
  return (
    <Modal title="Qo'shimcha ma'lumot" onClose={onClose}>
      <textarea rows={5} value={txt} onChange={(e) => setTxt(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
      <button
        onClick={async () => {
          const { error } = await supabase.from("students").update({ notes: txt }).eq("id", studentId);
          if (error) toast.error(error.message); else { toast.success("Saqlandi"); onSaved(); }
        }}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >Saqlash</button>
    </Modal>
  );
}

function ParentEditModal({
  studentId, initial, onClose, onSaved,
}: {
  studentId: string;
  initial: { parent_full_name: string; parent_phone: string; parent_telegram_chat_id: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <Modal title="Ota-ona ma'lumotlari" onClose={onClose}>
      <label className="block text-sm">
        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">F.I.O</div>
        <input value={f.parent_full_name} onChange={(e) => setF({ ...f, parent_full_name: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
      </label>
      <label className="block text-sm">
        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Telefon</div>
        <input value={f.parent_phone} onChange={(e) => setF({ ...f, parent_phone: e.target.value })} placeholder="+998 90 000 00 00" className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
      </label>
      <label className="block text-sm">
        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Telegram chat ID</div>
        <input value={f.parent_telegram_chat_id} onChange={(e) => setF({ ...f, parent_telegram_chat_id: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
      </label>
      <button
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          const { error } = await supabase.from("students").update({
            parent_full_name: f.parent_full_name || null,
            parent_phone: f.parent_phone || null,
            parent_telegram_chat_id: f.parent_telegram_chat_id || null,
          }).eq("id", studentId);
          if (error) toast.error(error.message); else { toast.success("Saqlandi"); onSaved(); }
          setSaving(false);
        }}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >Saqlash</button>
    </Modal>
  );
}



function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export { Link };
