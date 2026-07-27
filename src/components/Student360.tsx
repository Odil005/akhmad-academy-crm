import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CreditCard, UserPlus, Repeat, Phone, Send, Pencil, Snowflake, Archive,
  Loader2, CalendarDays, GraduationCap, MessageSquare, Wallet, BookOpen,
} from "lucide-react";
import { initialsOf, shortId, type StudentIndexRow } from "@/lib/admin-search";
import { STATUS_META } from "@/lib/status";

const fmt = (n: number) => Number(n || 0).toLocaleString("uz-UZ");
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

type Enrollment = {
  id: string;
  group_id: string;
  started_at: string | null;
  ended_at: string | null;
  status: string;
  monthly_fee: number | null;
  group: {
    id: string; name: string; monthly_fee: number; schedule: string | null;
    subject: { name: string } | null;
    teacher: { full_name: string | null } | null;
  } | null;
};

type Payment = {
  id: string; amount: number; total_amount: number | null; discount_amount: number | null;
  discount_reason: string | null; status: string; period_month: string; paid_at: string | null;
  next_due_date: string | null; course_id: string | null; payment_method: string | null;
};

type AttendanceRow = { id: string; date: string; status: string; note: string | null };
type GradeRow = { id: string; score: number; max_score: number; kind: string; graded_at: string; comment: string | null };
type MessageRow = { id: string; message: string; sender_role: string; created_at: string; status: string };

type Detail = {
  student: any;
  enrollments: Enrollment[];
  payments: Payment[];
  attendance: AttendanceRow[];
  grades: GradeRow[];
  messages: MessageRow[];
};

const TABS = ["Umumiy", "Kurslar", "To'lovlar", "Davomat", "Baholar", "Xabarlar"] as const;
type Tab = (typeof TABS)[number];

export function Student360({
  row,
  onPay,
  onChanged,
}: {
  row: StudentIndexRow;
  onPay: (studentId: string) => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Umumiy");
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [groupPicker, setGroupPicker] = useState<null | "add" | "move">(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      const from = monthStart.toISOString().slice(0, 10);
      const to = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).toISOString().slice(0, 10);

      const [s, enr, pay, att, gr, msg] = await Promise.all([
        supabase
          .from("students")
          .select("*, profile:profiles(full_name, phone, avatar_url)")
          .eq("id", row.id)
          .maybeSingle(),
        supabase
          .from("student_enrollments")
          .select(
            "id, group_id, started_at, ended_at, status, monthly_fee, group:groups(id, name, monthly_fee, schedule, subject:subjects(name), teacher:profiles!groups_teacher_id_fkey(full_name))",
          )
          .eq("student_id", row.id),
        supabase.from("payments").select("*").eq("student_id", row.id).order("period_month", { ascending: false }).limit(50),
        supabase.from("attendance").select("id, date, status, note").eq("student_id", row.id).gte("date", from).lte("date", to),
        supabase.from("grades").select("id, score, max_score, kind, graded_at, comment").eq("student_id", row.id).order("graded_at", { ascending: false }).limit(20),
        supabase.from("parent_teacher_messages").select("id, message, sender_role, created_at, status").eq("student_id", row.id).order("created_at", { ascending: false }).limit(20),
      ]);
      if (s.error) throw s.error;
      setData({
        student: s.data,
        enrollments: ((enr.data as never) ?? []) as Enrollment[],
        payments: ((pay.data as never) ?? []) as Payment[],
        attendance: (att.data ?? []) as AttendanceRow[],
        grades: (gr.data ?? []) as GradeRow[],
        messages: (msg.data ?? []) as MessageRow[],
      });
    } catch (e: any) {
      setError(e?.message ?? "Ma'lumotni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [row.id]);

  useEffect(() => {
    setTab("Umumiy");
    load();
  }, [load]);

  const changeStatus = async (to: "frozen" | "archived") => {
    const label = to === "frozen" ? "muzlatmoqchimisiz" : "arxivga o'tkazmoqchimisiz";
    if (!confirm(`${row.name} — rostdan ham ${label}?`)) return;
    setBusy(true);
    const from = data?.student?.status_enum ?? null;
    const { error: e } = await supabase.from("students").update({ status_enum: to }).eq("id", row.id);
    if (e) toast.error(e.message);
    else {
      await supabase.from("student_status_history").insert({ student_id: row.id, from_status: from, to_status: to });
      toast.success(to === "frozen" ? "Muzlatildi" : "Arxivlandi");
      await load();
      onChanged();
    }
    setBusy(false);
  };

  const student = data?.student;
  const phone = student?.profile?.phone ?? row.phone ?? "";
  const parentPhone = student?.parent_phone ?? row.parent_phone ?? "";
  const statusMeta =
    STATUS_META[(student?.status_enum ?? row.status_enum) as keyof typeof STATUS_META] ?? { label: row.status_enum, bg: "bg-muted" };

  const debt = useMemo(
    () => (data?.payments ?? []).filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.total_amount ?? p.amount), 0),
    [data],
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      {/* LEFT — profile */}
      <aside className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          {student?.profile?.avatar_url ? (
            <img src={student.profile.avatar_url} alt={row.name} className="h-16 w-16 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
              {initialsOf(row.name)}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-xl font-extrabold">{row.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md bg-secondary px-2 py-0.5 font-mono font-semibold">{shortId(row.id)}</span>
              <span className={`rounded-full px-2 py-0.5 font-semibold text-white ${statusMeta.bg}`}>{statusMeta.label}</span>
            </div>
          </div>
        </div>

        <dl className="space-y-2 border-t border-border pt-4 text-sm">
          <Info label="Telefon" value={phone || "—"} />
          <Info label="Ota-ona" value={student?.parent_full_name || "—"} />
          <Info label="Ota-ona tel." value={parentPhone || "—"} />
          <Info
            label="Telegram"
            value={student?.parent_telegram_chat_id ? "Ulangan" : "Ulanmagan"}
            tone={student?.parent_telegram_chat_id ? "ok" : "muted"}
          />
          <Info label="Qo'shilgan" value={student?.enrolled_at ? new Date(student.enrolled_at).toLocaleDateString("uz-UZ") : "—"} />
          <Info label="Guruhlar" value={row.groupNames.join(", ") || "Guruhsiz"} />
        </dl>

        <div className="space-y-2 border-t border-border pt-4">
          <Action primary icon={CreditCard} label="To'lov olish" onClick={() => onPay(row.id)} />
          <Action primary icon={UserPlus} label="Guruhga qo'shish" onClick={() => setGroupPicker("add")} />
          <Action icon={Repeat} label="Guruhni almashtirish" onClick={() => setGroupPicker("move")} />
          <Action
            icon={Phone}
            label="Telefon qilish"
            disabled={!(phone || parentPhone)}
            onClick={() => { window.location.href = `tel:${(phone || parentPhone).replace(/\s+/g, "")}`; }}
          />
          <Link
            to="/messages"
            className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold transition hover:border-primary"
          >
            <Send className="h-4 w-4 text-primary" /> Telegram xabar yuborish
          </Link>
          <Link
            to="/students/$id"
            params={{ id: row.id }}
            className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold transition hover:border-primary"
          >
            <Pencil className="h-4 w-4 text-primary" /> Profilni tahrirlash
          </Link>
          <Action danger icon={Snowflake} label="Muzlatish" disabled={busy} onClick={() => changeStatus("frozen")} />
          <Action danger icon={Archive} label="Arxivga o'tkazish" disabled={busy} onClick={() => changeStatus("archived")} />
        </div>
      </aside>

      {/* RIGHT — tabs */}
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1.5">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-secondary/60" />)}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            {error} <button onClick={load} className="font-semibold underline">Qayta urinish</button>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {(tab === "Umumiy" || tab === "Kurslar") && (
              <CourseCards enrollments={data.enrollments} payments={data.payments} student={data.student} onPay={() => onPay(row.id)} />
            )}
            {(tab === "Umumiy" || tab === "Davomat") && <AttendanceCalendar rows={data.attendance} />}
            {(tab === "Umumiy" || tab === "To'lovlar") && <PaymentsPanel payments={data.payments} debt={debt} />}
            {(tab === "Umumiy" || tab === "Baholar") && <GradesPanel grades={data.grades} />}
            {(tab === "Umumiy" || tab === "Xabarlar") && <MessagesPanel messages={data.messages} />}
          </>
        )}
      </section>

      {groupPicker && (
        <GroupPicker
          mode={groupPicker}
          studentId={row.id}
          currentGroupIds={(data?.enrollments ?? []).filter((e) => e.status === "active").map((e) => e.group_id)}
          onClose={() => setGroupPicker(null)}
          onDone={async () => { setGroupPicker(null); await load(); onChanged(); }}
        />
      )}
    </div>
  );
}

function Info({ label, value, tone }: { label: string; value: string; tone?: "ok" | "muted" }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`text-right font-semibold ${tone === "ok" ? "text-green-600" : tone === "muted" ? "text-muted-foreground" : ""}`}>{value}</dd>
    </div>
  );
}

function Action({
  icon: Icon, label, onClick, primary, danger, disabled,
}: {
  icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void;
  primary?: boolean; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
        primary
          ? "bg-primary text-primary-foreground hover:opacity-90"
          : danger
            ? "border border-destructive/40 text-destructive hover:bg-destructive/10"
            : "border border-border hover:border-primary"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

/* ------------------------- course cards --------------------------- */

function payStateFor(payments: Payment[], groupId: string | null) {
  const rel = payments.filter((p) => (groupId ? p.course_id === groupId || p.course_id === null : true));
  const debt = rel.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.total_amount ?? p.amount), 0);
  const monthKey = monthKeyOf(new Date());
  const paidThisMonth = rel.some((p) => p.status === "paid" && String(p.period_month).slice(0, 7) === monthKey);
  const nextDue = rel.map((p) => p.next_due_date).filter(Boolean).sort()[0] ?? null;
  return { debt, paidThisMonth, nextDue, rel };
}

function CourseCards({
  enrollments, payments, student, onPay,
}: { enrollments: Enrollment[]; payments: Payment[]; student: any; onPay: () => void }) {
  const active = enrollments.filter((e) => e.status === "active");
  const list = active.length ? active : enrollments;

  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        O'quvchi hech qaysi guruhga biriktirilmagan.
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {list.map((e) => {
        const st = payStateFor(payments, e.group_id);
        const frozen = student?.status_enum === "frozen";
        const badge = frozen
          ? { text: "Muzlatilgan", cls: "bg-muted text-muted-foreground" }
          : st.debt > 0
            ? { text: `${fmt(st.debt)} so'm qarzdor`, cls: "bg-destructive/15 text-destructive" }
            : st.paidThisMonth
              ? { text: `${new Date().toLocaleDateString("uz-UZ", { month: "long", year: "numeric" })} uchun to'langan`, cls: "bg-green-500/15 text-green-600" }
              : st.nextDue && (new Date(st.nextDue).getTime() - Date.now()) / 86400000 <= 3
                ? { text: "To'lov yaqinlashmoqda", cls: "bg-amber-500/20 text-amber-700" }
                : { text: "To'lov kutilmoqda", cls: "bg-secondary text-muted-foreground" };

        return (
          <article key={e.id} className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <div className={`rounded-xl px-3 py-2 text-sm font-bold ${badge.cls}`}>{badge.text}</div>
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold">
                  {e.group?.subject?.name ?? "Fan"} — {e.group?.name ?? "Guruh"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  O'qituvchi: {e.group?.teacher?.full_name ?? "—"} · Holat: {e.status}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <Info label="Jadval" value={e.group?.schedule || "—"} />
              <Info label="Oylik" value={`${fmt(Number(e.monthly_fee ?? e.group?.monthly_fee ?? 0))} so'm`} />
              <Info label="Boshlangan" value={e.started_at ? new Date(e.started_at).toLocaleDateString("uz-UZ") : "—"} />
              <Info label="Tugash" value={e.ended_at ? new Date(e.ended_at).toLocaleDateString("uz-UZ") : "—"} />
              <Info label="Keyingi to'lov" value={st.nextDue ? new Date(st.nextDue).toLocaleDateString("uz-UZ") : "—"} />
              <Info label="Qarz" value={`${fmt(st.debt)} so'm`} />
            </dl>
            <button onClick={onPay} className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90">
              To'lov olish
            </button>
          </article>
        );
      })}
    </div>
  );
}

/* ------------------------- attendance ----------------------------- */

const ATT_CLS: Record<string, string> = {
  present: "bg-green-500/20 text-green-700",
  absent: "bg-destructive/20 text-destructive",
  excused: "bg-amber-500/25 text-amber-700",
  late: "bg-blue-500/20 text-blue-700",
};
const ATT_LABEL: Record<string, string> = {
  present: "Qatnashgan", absent: "Kelmagan", excused: "Sababli", late: "Kechikkan",
};

function AttendanceCalendar({ rows }: { rows: AttendanceRow[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // monday-first
  const byDay = new Map<number, AttendanceRow>();
  rows.forEach((r) => byDay.set(new Date(r.date).getDate(), r));
  const present = rows.filter((r) => r.status === "present" || r.status === "late").length;
  const rate = rows.length ? Math.round((present / rows.length) * 100) : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-bold">
          <CalendarDays className="h-4 w-4 text-primary" />
          Davomat — {now.toLocaleDateString("uz-UZ", { month: "long", year: "numeric" })}
        </h3>
        <span className="text-sm font-semibold text-green-600">{rate}% qatnashgan</span>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-xs">
        {["Du", "Se", "Cho", "Pa", "Ju", "Sha", "Ya"].map((d) => (
          <div key={d} className="pb-1 font-semibold text-muted-foreground">{d}</div>
        ))}
        {Array.from({ length: lead }).map((_, i) => <div key={`x${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const rec = byDay.get(day);
          const isToday = day === now.getDate();
          const cls = rec ? ATT_CLS[rec.status] ?? "bg-secondary" : "bg-transparent text-muted-foreground";
          const title = rec
            ? `${new Date(rec.date).toLocaleDateString("uz-UZ")} · ${ATT_LABEL[rec.status] ?? rec.status}${rec.note ? ` · ${rec.note}` : ""}`
            : `${day}-kun · dars belgilanmagan`;
          return (
            <div
              key={day}
              title={title}
              className={`rounded-lg border py-1.5 font-semibold ${cls} ${isToday ? "border-primary" : "border-border/60"}`}
            >
              {day}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {Object.entries(ATT_LABEL).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${ATT_CLS[k].split(" ")[0]}`} /> {v}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------- payments ------------------------------- */

function PaymentsPanel({ payments, debt }: { payments: Payment[]; debt: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-bold"><Wallet className="h-4 w-4 text-primary" /> To'lovlar</h3>
        <span className={`text-sm font-bold ${debt > 0 ? "text-destructive" : "text-green-600"}`}>
          {debt > 0 ? `${fmt(debt)} so'm qarz` : "Qarzdorlik yo'q"}
        </span>
      </div>
      <div className="mt-3 divide-y divide-border text-sm">
        {payments.length === 0 && <p className="py-3 text-muted-foreground">To'lov yozuvi yo'q</p>}
        {payments.slice(0, 12).map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <span>{new Date(p.period_month).toLocaleDateString("uz-UZ", { year: "numeric", month: "long" })}</span>
            <span className="font-semibold">{fmt(Number(p.total_amount ?? p.amount))} so'm</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === "paid" ? "bg-green-500/15 text-green-600" : "bg-destructive/15 text-destructive"}`}>
              {p.status === "paid" ? "To'langan" : "Kutilmoqda"}
            </span>
            {p.status === "paid" && (
              <a href={`/receipt/${p.id}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary hover:underline">
                Chek
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function GradesPanel({ grades }: { grades: GradeRow[] }) {
  const avg = grades.length
    ? Math.round((grades.reduce((s, g) => s + (Number(g.score) / Number(g.max_score || 1)) * 100, 0) / grades.length))
    : null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-bold"><GraduationCap className="h-4 w-4 text-primary" /> Baholar</h3>
        {avg !== null && <span className="text-sm font-semibold">O'rtacha: {avg}%</span>}
      </div>
      <div className="mt-3 divide-y divide-border text-sm">
        {grades.length === 0 && <p className="py-3 text-muted-foreground">Baho yozuvi yo'q</p>}
        {grades.map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-2 py-2.5">
            <span className="text-muted-foreground">{new Date(g.graded_at).toLocaleDateString("uz-UZ")} · {g.kind}</span>
            <span className="font-semibold">{g.score}/{g.max_score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessagesPanel({ messages }: { messages: MessageRow[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 text-base font-bold"><MessageSquare className="h-4 w-4 text-primary" /> Xabarlar</h3>
      <div className="mt-3 space-y-2 text-sm">
        {messages.length === 0 && <p className="text-muted-foreground">Xabarlar yo'q</p>}
        {messages.map((m) => (
          <div key={m.id} className="rounded-xl border border-border p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {m.sender_role} · {new Date(m.created_at).toLocaleString("uz-UZ")}
            </div>
            <p className="mt-1">{m.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------- group picker --------------------------- */

function GroupPicker({
  mode, studentId, currentGroupIds, onClose, onDone,
}: {
  mode: "add" | "move"; studentId: string; currentGroupIds: string[];
  onClose: () => void; onDone: () => void;
}) {
  const [groups, setGroups] = useState<Array<{ id: string; name: string; monthly_fee: number; subject: { name: string } | null }>>([]);
  const [groupId, setGroupId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("groups")
      .select("id, name, monthly_fee, subject:subjects(name)")
      .order("name")
      .then(({ data }) => setGroups((data as never) ?? []));
  }, []);

  const save = async () => {
    if (!groupId) return;
    setBusy(true);
    try {
      if (mode === "move" && currentGroupIds.length) {
        const { error } = await supabase
          .from("student_enrollments")
          .update({ status: "ended", ended_at: new Date().toISOString().slice(0, 10) })
          .eq("student_id", studentId)
          .eq("status", "active");
        if (error) throw error;
      }
      const fee = groups.find((g) => g.id === groupId)?.monthly_fee ?? null;
      const { error } = await supabase.from("student_enrollments").insert({
        student_id: studentId,
        group_id: groupId,
        monthly_fee: fee,
        started_at: new Date().toISOString().slice(0, 10),
        status: "active",
      });
      if (error) throw error;
      await supabase.from("students").update({ group_id: groupId }).eq("id", studentId);
      toast.success(mode === "move" ? "Guruh almashtirildi" : "Guruhga qo'shildi");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Xatolik");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold">{mode === "move" ? "Guruhni almashtirish" : "Guruhga qo'shish"}</h3>
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
        >
          <option value="">— guruhni tanlang —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}{g.subject?.name ? ` · ${g.subject.name}` : ""}
            </option>
          ))}
        </select>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">Bekor</button>
          <button
            onClick={save}
            disabled={!groupId || busy}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Saqlash
          </button>
        </div>
      </div>
    </div>
  );
}
