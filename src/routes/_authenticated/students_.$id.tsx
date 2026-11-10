import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, FileText, Snowflake, MessageSquare, Pencil, Phone, Printer, Send, StickyNote, UserPlus, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { STATUS_META, STATUS_ORDER, type StudentStatus } from "@/lib/status";
import { TelegramIdField } from "@/components/TelegramIdField";
import { LowIncomeBadge } from "@/components/LowIncomeBadge";
import { StudentFeeEditor } from "@/components/StudentFeeEditor";
import { canPrintReceipt, printPaymentReceipt } from "@/lib/payment-receipt";
import { examLevel, examPercent } from "@/lib/exam-score";

const PaymentModal = lazy(() => import("@/components/PaymentModal").then((m) => ({ default: m.PaymentModal })));
const DAYS_SHORT = ["Yak", "Du", "Se", "Chor", "Pay", "Ju", "Sha"];

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
  frozen_until: string | null;
  frozen_reason: string | null;
  profile: { id: string; full_name: string | null; phone: string | null } | null;
};

type Group = { id: string; name: string; monthly_fee: number; subject_id: string | null; teacher_id: string | null };
type Enrollment = {
  id: string;
  group_id: string;
  subject_id: string | null;
  teacher_user_id: string | null;
  started_at: string;
  ended_at: string | null;
  monthly_fee: number | null;
  status: string;
  group: { id: string; name: string; monthly_fee: number; teacher_id?: string | null; subject: { name: string } | null; teacher: { full_name: string | null } | null } | null;
};
type LessonRow = { group_id: string; day_of_week: number; start_time: string; end_time: string };
type PaymentRow = {
  id: string; student_id: string; amount: number; subtotal: number | null; total_amount: number | null; paid_amount: number | null;
  discount_amount: number | null; period_month: string; status: string; paid_at: string | null; created_at: string;
  note: string | null; payment_method: string | null; cashier_id: string | null; course_id: string | null;
  course: { name: string } | null;
};
type ExamRow = { id: string; score: number; max_score: number | null; comment: string | null; graded_at: string };
type AttendanceRow = { id: string; date: string; status: string; note: string | null };
const ATT_META: Record<string, { label: string; cls: string }> = {
  present: { label: "Keldi", cls: "bg-emerald-500/15 text-emerald-400" },
  late: { label: "Kechikdi", cls: "bg-amber-500/15 text-amber-400" },
  absent: { label: "Kelmadi", cls: "bg-destructive/15 text-destructive" },
  excused: { label: "Sababli", cls: "bg-sky-500/15 text-sky-400" },
};
const PAY_META: Record<string, { label: string; cls: string }> = {
  paid: { label: "To'langan", cls: "bg-emerald-500/15 text-emerald-400" },
  partial: { label: "Qisman", cls: "bg-amber-500/15 text-amber-400" },
  pending: { label: "Kutilmoqda", cls: "bg-secondary text-muted-foreground" },
  overdue: { label: "Muddati o'tgan", cls: "bg-destructive/15 text-destructive" },
  refunded: { label: "Qaytarilgan", cls: "bg-sky-500/15 text-sky-400" },
  voided: { label: "Bekor qilingan", cls: "bg-muted text-muted-foreground" },
};
const METHOD_LABEL: Record<string, string> = { cash: "Naqd", card: "Karta", qr: "QR", transfer: "O'tkazma" };
const money = (n: number) => `${Number(n || 0).toLocaleString("uz-UZ")} so'm`;
const DEBT_STATUSES = ["pending", "partial", "overdue"];

export const Route = createFileRoute("/_authenticated/students_/$id")({
  head: () => ({ meta: [
    { title: "O‘quvchi profili | Akhmad Academy" },
    { name: "description", content: "O‘quvchining guruhlari, to‘lovlari, cheklari va davomati bir sahifada." },
    { property: "og:title", content: "O‘quvchi profili | Akhmad Academy" },
    { property: "og:description", content: "Guruh, to‘lov, chek va davomat — bitta profilda." },
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
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);
  const [printing, setPrinting] = useState<string | null>(null);
  const [tgLink, setTgLink] = useState<{ link: string | null; token: string; expires_at: string } | null>(null);
  const [tgLoading, setTgLoading] = useState(false);

  const load = async () => {
    const [{ data: s }, { data: enr }, { data: pays }, { data: gs }, { data: att }] = await Promise.all([
      supabase.from("students").select(`
        id, monthly_fee, status_enum, enrolled_at, full_name, first_name, last_name, parent_full_name, parent_phone, parent_telegram_chat_id, notes, low_income, low_income_note, frozen_until, frozen_reason,
        telegram_chat_id, telegram_username, telegram_verified_at, telegram_last_checked_at, telegram_last_error,
        profile:profiles(id, full_name, phone)
      `).eq("id", id).maybeSingle(),
      supabase.from("student_enrollments").select(`
        id, group_id, subject_id, teacher_user_id, started_at, ended_at, monthly_fee, status,
        group:groups(id, name, monthly_fee, teacher_id, subject:subjects(name))
      `).eq("student_id", id).order("started_at", { ascending: false }),
      supabase.from("payments")
        .select("id, student_id, amount, subtotal, total_amount, paid_amount, discount_amount, period_month, status, paid_at, created_at, note, payment_method, cashier_id, course_id, course:groups!payments_course_id_fkey(name)")
        .eq("student_id", id).order("created_at", { ascending: false }).limit(200),
      supabase.from("groups").select("id, name, monthly_fee, subject_id, teacher_id").order("name"),
      supabase.from("attendance").select("id, date, status, note").eq("student_id", id).order("date", { ascending: false }).limit(120),
    ]);
    const enrolls = ((enr as never) ?? []) as Enrollment[];
    const tIds = [...new Set(enrolls.map((e) => e.group?.teacher_id).filter(Boolean))] as string[];
    const groupIds = enrolls.filter((e) => e.status === "active" || e.status === "trial").map((e) => e.group_id);
    const [tprofs, l] = await Promise.all([
      tIds.length ? supabase.from("profiles").select("id, full_name").in("id", tIds) : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
      groupIds.length
        ? supabase.from("lessons").select("group_id, day_of_week, start_time, end_time").in("group_id", groupIds).eq("is_active", true)
        : Promise.resolve({ data: [] as LessonRow[] }),
    ]);
    const names = new Map((tprofs.data ?? []).map((p) => [p.id, p.full_name ?? ""]));
    enrolls.forEach((e) => { if (e.group) e.group.teacher = { full_name: names.get(e.group.teacher_id ?? "") ?? null }; });
    setStudent((s as never) ?? null);
    setEnrollments(enrolls);
    setPayments((pays as never) ?? []);
    setGroups((gs as never) ?? []);
    setAttendance((att as never) ?? []);
    setLessons((l.data as never) ?? []);
    const { data: ex } = await supabase.from("grades").select("id, score, max_score, comment, graded_at")
      .eq("student_id", id).eq("kind", "exam").order("graded_at", { ascending: false }).limit(24);
    setExams((ex as ExamRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { setLoading(true); void load(); }, [id]);

  const activeEnrollments = useMemo(() => enrollments.filter((e) => e.status === "active" || e.status === "trial"), [enrollments]);
  const pastEnrollments = useMemo(() => enrollments.filter((e) => e.status !== "active" && e.status !== "trial"), [enrollments]);
  const totalMonthlyFee = useMemo(
    () => enrollments.some((e) => e.status === "active")
      ? enrollments.filter((e) => e.status === "active").reduce((sum, e) => sum + Number(e.monthly_fee ?? e.group?.monthly_fee ?? 0), 0)
      : Number(student?.monthly_fee ?? 0),
    [enrollments, student],
  );
  const debt = useMemo(
    () => payments.filter((p) => DEBT_STATUSES.includes(p.status))
      .reduce((sum, p) => sum + Math.max(0, Number(p.total_amount ?? p.amount ?? 0) - Number(p.paid_amount ?? 0)), 0),
    [payments],
  );
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

  if (loading) return <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Yuklanmoqda...</div>;
  if (!student) return <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">O'quvchi topilmadi</div>;

  const status = (student.status_enum ?? "active") as StudentStatus;
  const meta = STATUS_META[status];
  const studentName =
    student.full_name?.trim() ||
    [student.last_name, student.first_name].filter(Boolean).join(" ").trim() ||
    student.profile?.full_name?.trim() ||
    "Ismsiz o'quvchi";
  const initials = (studentName || "??").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const changeStatus = async (v: StudentStatus) => {
    const { error } = await supabase.from("students").update({ status_enum: v }).eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.from("student_status_history").insert({ student_id: id, from_status: student.status_enum ?? undefined, to_status: v });
    toast.success("Holat o'zgardi");
    void load();
  };

  const freezeStudent = async () => {
    if (status === "frozen") {
      const { error } = await supabase.from("students").update({ status_enum: "active", frozen_until: null, frozen_reason: null }).eq("id", id);
      if (error) return toast.error(error.message);
      await supabase.from("student_status_history").insert({ student_id: id, from_status: "frozen", to_status: "active" });
      toast.success("Muzlatish bekor qilindi");
      return void load();
    }
    const until = prompt("Qaysi sanagacha muzlatiladi? (YYYY-MM-DD)", new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10));
    if (!until) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) return toast.error("Sana noto'g'ri");
    const reason = prompt("Sababi (masalan: kasallik)") ?? "";
    const { error } = await supabase.from("students").update({ status_enum: "frozen", frozen_until: until, frozen_reason: reason.trim() || null }).eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.from("student_status_history").insert({ student_id: id, from_status: student.status_enum ?? undefined, to_status: "frozen" });
    toast.success(`${until} gacha muzlatildi — bu muddatda oylik hisoblanmaydi`);
    void load();
  };

  const printStudentContract = async () => {
    const [{ getMyCenterProfile }, { printContract }] = await Promise.all([import("@/lib/tenant.functions"), import("@/lib/contract-print")]);
    const brand = await getMyCenterProfile().catch(() => null);
    printContract({
      centerName: brand?.name || "Akhmad Academy",
      centerPhone: brand?.phone ?? null,
      centerAddress: brand?.address ?? null,
      studentName,
      studentPhone: student.profile?.phone ?? null,
      parentName: student.parent_full_name,
      parentPhone: student.parent_phone,
      groups: activeEnrollments.map((e) => ({ name: e.group?.name ?? "Guruh", fee: Number(e.monthly_fee ?? e.group?.monthly_fee ?? 0) })),
      date: new Date(),
      number: id.slice(0, 6).toUpperCase(),
    });
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
    toast.success(value ? "Reyestrga qo'shildi" : "Reyestrdan olindi");
    void load();
  };

  const editLowIncomeNote = async () => {
    const note = prompt("Qisqa izoh (masalan: mahalla ma'lumotnomasi bor)", student?.low_income_note ?? "");
    if (note === null) return;
    const { error } = await supabase.from("students").update({ low_income_note: note.trim() || null }).eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  const printReceipt = async (p: PaymentRow) => {
    setPrinting(p.id);
    try {
      await printPaymentReceipt({ ...p, course_name: p.course?.name ?? null }, studentName);
    } catch (e) {
      toast.error((e as Error)?.message || "Chek chiqmadi");
    } finally {
      setPrinting(null);
    }
  };

  const phone = student.profile?.phone;

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ to: "/students" })} className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary/50">
        <ArrowLeft className="h-3.5 w-3.5" /> O'quvchilar
      </button>

      {/* Header: identity + the actions an admin uses every day */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-extrabold text-primary-foreground lg:h-14 lg:w-14 lg:rounded-xl lg:bg-primary/15 lg:text-xl lg:text-primary">{initials}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-xl font-extrabold tracking-tight lg:truncate">{studentName}</h1>
              {student.low_income && <LowIncomeBadge note={student.low_income_note} />}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {phone || "Telefon yo'q"}</span>
              <span>Ota-ona: <b className="text-foreground">{student.parent_full_name || "—"}</b> {student.parent_phone ? `· ${student.parent_phone}` : ""}</span>
              <span>Bot: {student.parent_telegram_chat_id ? "ulangan" : "ulanmagan"}</span>
            </div>
            <select
              value={status}
              onChange={(e) => void changeStatus(e.target.value as StudentStatus)}
              aria-label="O'quvchi holati"
              className={`mt-2 rounded-full border-transparent px-3 py-1.5 text-sm font-semibold lg:hidden ${meta.tint}`}
            >
              {STATUS_ORDER.map((k) => <option key={k} value={k}>{STATUS_META[k].label}</option>)}
            </select>
          </div>
          <select
            value={status}
            onChange={(e) => void changeStatus(e.target.value as StudentStatus)}
            aria-label="O'quvchi holati"
            className={`hidden rounded-lg border-transparent px-3 py-1.5 text-xs font-semibold lg:block ${meta.tint}`}
          >
            {STATUS_ORDER.map((k) => <option key={k} value={k}>{STATUS_META[k].label}</option>)}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => setPayOpen(true)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-base font-bold text-primary-foreground hover:bg-primary/90 sm:w-auto sm:rounded-lg sm:py-2 sm:text-sm">
            <Wallet className="h-4 w-4" /> To'lov qabul qilish
          </button>
          <button onClick={() => setAssignOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50">
            <Users className="h-3.5 w-3.5" /> Guruhlar
          </button>
          <button onClick={() => setParentOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50">
            <Pencil className="h-3.5 w-3.5" /> Ota-ona
          </button>
          <button onClick={() => void sendTelegram()} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50">
            <MessageSquare className="h-3.5 w-3.5" /> Xabar
          </button>
          <button onClick={() => setNoteOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50">
            <StickyNote className="h-3.5 w-3.5" /> Izoh
          </button>
          <button onClick={() => void freezeStudent()} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50">
            <Snowflake className="h-3.5 w-3.5" /> {status === "frozen" ? "Muzlatishni bekor qilish" : "Muzlatish"}
          </button>
          <button onClick={() => void printStudentContract()} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50">
            <FileText className="h-3.5 w-3.5" /> Shartnoma
          </button>
        </div>
        {status === "frozen" && student.frozen_until && (
          <p className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
            Muzlatilgan: {student.frozen_until} gacha{student.frozen_reason ? ` · ${student.frozen_reason}` : ""}. Bu muddatda oylik hisoblanmaydi.
          </p>
        )}
        {student.notes && <p className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{student.notes}</p>}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Qarz" value={debt > 0 ? money(debt) : "Qarz yo'q"} tone={debt > 0 ? "text-destructive" : "text-emerald-400"} hint={debt > 0 ? "to'lanmagan hisoblar" : "hammasi to'langan"} />
        <Kpi label="Oylik to'lov" value={money(totalMonthlyFee)} hint={`${activeEnrollments.length} ta faol guruh`} />
        <Kpi label="Davomat" value={attStats.percent === null ? "—" : `${attStats.percent}%`} tone="text-primary" hint={`${attStats.total} ta dars belgilangan`} />
        <Kpi label="Oxirgi to'lov" value={lastPaid ? money(Number(lastPaid.total_amount || lastPaid.amount)) : "—"} hint={lastPaid?.paid_at ? new Date(lastPaid.paid_at).toLocaleDateString("uz-UZ") : "To'lov yo'q"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {/* Groups */}
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold">Guruhlari</h2>
              <button onClick={() => setAssignOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:border-primary/50">
                <UserPlus className="h-3.5 w-3.5" /> Qo'shish / almashtirish
              </button>
            </div>
            {activeEnrollments.length === 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-3 text-sm">
                <span className="text-muted-foreground">Hech qaysi guruhda emas. Oylik: <b className="text-foreground">{money(Number(student.monthly_fee ?? 0))}</b></span>
                <StudentFeeEditor studentId={id} amount={Number(student.monthly_fee ?? 0)} label={studentName} onSaved={load} />
              </div>
            )}
            <div className="divide-y divide-border">
              {activeEnrollments.map((e) => {
                const grpLessons = lessons.filter((l) => l.group_id === e.group_id);
                const fee = Number(e.monthly_fee ?? e.group?.monthly_fee ?? 0);
                const days = [...new Set(grpLessons.map((l) => DAYS_SHORT[l.day_of_week % 7]))].join(", ");
                const time = grpLessons[0] ? `${grpLessons[0].start_time.slice(0, 5)}–${grpLessons[0].end_time.slice(0, 5)}` : "";
                return (
                  <div key={e.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                      <Link to="/groups" search={{ group: e.group_id } as never} className="block truncate text-sm font-semibold hover:text-primary">
                        {e.group?.name ?? "Guruh"}
                      </Link>
                      <div className="truncate text-xs text-muted-foreground">
                        {[e.group?.subject?.name, e.group?.teacher?.full_name, days && `${days} ${time}`].filter(Boolean).join(" · ") || "Jadval belgilanmagan"}
                        {e.status === "trial" ? " · Sinov" : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{money(fee)}</span>
                      {e.status === "active" && <StudentFeeEditor studentId={id} enrollmentId={e.id} amount={fee} label={`${studentName} · ${e.group?.name ?? "Guruh"}`} onSaved={load} />}
                    </div>
                  </div>
                );
              })}
            </div>
            {pastEnrollments.length > 0 && (
              <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
                Avvalgi guruhlar: {pastEnrollments.map((e) => `${e.group?.name ?? "Guruh"}${e.ended_at ? ` (${e.ended_at.slice(0, 10)} gacha)` : ""}`).join(", ")}
              </p>
            )}
          </section>

          {/* Payments + receipts */}
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold">To'lovlar va cheklar</h2>
              <button onClick={() => setPayOpen(true)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                <Wallet className="h-3.5 w-3.5" /> To'lov
              </button>
            </div>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Hali to'lov yoki hisob yo'q</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase text-muted-foreground">
                    <tr><th className="py-2 pr-2">Oy</th><th className="pr-2">Guruh</th><th className="pr-2">Summa</th><th className="pr-2">Holat</th><th className="pr-2">Sana</th><th className="text-right">Chek</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payments.map((p) => {
                      const pm = PAY_META[p.status] ?? { label: p.status, cls: "bg-muted text-muted-foreground" };
                      const total = Number(p.total_amount || p.amount);
                      return (
                        <tr key={p.id}>
                          <td className="whitespace-nowrap py-2 pr-2">{p.period_month.slice(0, 7)}</td>
                          <td className="max-w-[160px] truncate pr-2 text-xs text-muted-foreground">{p.course?.name ?? "—"}</td>
                          <td className="whitespace-nowrap pr-2 font-semibold">
                            {p.status === "partial" ? `${Number(p.paid_amount ?? 0).toLocaleString("uz-UZ")} / ${total.toLocaleString("uz-UZ")}` : total.toLocaleString("uz-UZ")}
                            {p.payment_method && canPrintReceipt(p.status) && <span className="ml-1 text-[10px] font-normal text-muted-foreground">{METHOD_LABEL[p.payment_method] ?? ""}</span>}
                          </td>
                          <td className="pr-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pm.cls}`}>{pm.label}</span></td>
                          <td className="whitespace-nowrap pr-2 text-xs text-muted-foreground">{p.paid_at ? new Date(p.paid_at).toLocaleDateString("uz-UZ") : "—"}</td>
                          <td className="text-right">
                            {canPrintReceipt(p.status) ? (
                              <button
                                onClick={() => void printReceipt(p)}
                                disabled={printing === p.id}
                                title="Chekni chop etish"
                                aria-label="Chekni chop etish"
                                className="inline-grid h-7 w-7 place-items-center rounded-md border border-border hover:border-primary/50 hover:text-primary disabled:opacity-50"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Exam results */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-bold">Imtihon natijalari</h2>
            {exams.length === 0 ? (
              <p className="text-sm text-muted-foreground">Hali imtihon natijasi kiritilmagan</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {exams.map((g) => {
                  const pct = examPercent(Number(g.score), Number(g.max_score ?? 100));
                  return (
                    <li key={g.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="truncate">{g.comment || "Imtihon"} <span className="text-xs text-muted-foreground">· {g.graded_at}</span></span>
                      <span className="shrink-0 font-semibold">{Number(g.score)}/{Number(g.max_score ?? 100)} · {pct}% <span className="text-xs font-normal text-muted-foreground">{examLevel(pct)}</span></span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Attendance */}
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">Davomat</h2>
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
          </section>
        </div>

        {/* Side: rarely changed details */}
        <aside className="space-y-4">
          <section className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" checked={!!student.low_income} onChange={(e) => void setLowIncome(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span className="min-w-0">
                <span className="block text-xs font-bold">Kambag'al oila reyestrida</span>
                <span className="block text-[11px] text-muted-foreground">Ro'yxatlarda alohida belgi bilan ko'rinadi.</span>
              </span>
            </label>
            {student.low_income && (
              <button onClick={() => void editLowIncomeNote()} className="mt-2 text-[11px] font-bold underline">
                {student.low_income_note ? `Izoh: ${student.low_income_note}` : "Izoh qo'shish"}
              </button>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Telegram</h2>
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
            <button onClick={() => void generateTgLink()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:border-primary/50">
              <Send className="h-3 w-3" /> {tgLoading ? "..." : "Ota-ona uchun bot havolasi"}
            </button>
            {tgLink && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs">
                <div className="mb-1 font-bold text-primary">7 kun amal qiladi</div>
                {tgLink.link ? (
                  <a href={tgLink.link} target="_blank" rel="noreferrer" className="break-all font-mono text-primary underline">{tgLink.link}</a>
                ) : (
                  <div className="break-all font-mono">Token: {tgLink.token}</div>
                )}
              </div>
            )}
          </section>
          <p className="px-1 text-[11px] text-muted-foreground">ID: {student.id.slice(0, 8)} · Qo'shilgan: {student.enrolled_at?.slice(0, 10) ?? "—"}</p>
        </aside>
      </div>

      {assignOpen && (
        <GroupManageModal
          studentId={id}
          enrollments={enrollments}
          groups={groups}
          onClose={() => setAssignOpen(false)}
          onSaved={() => { setAssignOpen(false); void load(); }}
        />
      )}
      {payOpen && (
        <Suspense fallback={null}>
          <PaymentModal initialStudentId={id} onClose={() => setPayOpen(false)} onDone={() => void load()} />
        </Suspense>
      )}
      {noteOpen && (
        <NotesModal
          initial={student.notes ?? ""}
          onClose={() => setNoteOpen(false)}
          onSaved={() => { setNoteOpen(false); void load(); }}
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
          onSaved={() => { setParentOpen(false); void load(); }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 truncate text-lg font-extrabold ${tone ?? ""}`}>{value}</div>
      <div className="truncate text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
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

