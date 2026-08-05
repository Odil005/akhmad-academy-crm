import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, UserPlus, CreditCard, Loader2, Users, Wallet, CalendarDays, AlertTriangle, Clock, GraduationCap,
} from "lucide-react";
import {
  loadStudentIndex, searchIndex, initialsOf, shortId, type StudentIndexRow,
} from "@/lib/admin-search";
import { STATUS_META } from "@/lib/status";
import { Student360 } from "@/components/Student360";
import { PaymentModal } from "@/components/PaymentModal";
import { NewTeacherModal } from "@/components/NewTeacherModal";
import { TelegramLinkPanel } from "@/components/TelegramLinkPanel";

const fmt = (n: number) => Number(n || 0).toLocaleString("uz-UZ");

type Lesson = {
  id: string;
  start_time: string;
  end_time: string;
  group: { name: string; subject: { name: string } | null } | null;
  teacher: { full_name: string | null } | null;
  room: { name: string } | null;
  group_id: string;
};

export function AdminDesk() {
  const [index, setIndex] = useState<StudentIndexRow[]>([]);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [indexLoading, setIndexLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [openList, setOpenList] = useState(false);
  const [selected, setSelected] = useState<StudentIndexRow | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [newTeacher, setNewTeacher] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const refreshIndex = useCallback(async () => {
    setIndexLoading(true);
    try {
      const rows = await loadStudentIndex();
      setIndex(rows);
      setIndexError(null);
      setSelected((cur) => (cur ? rows.find((r) => r.id === cur.id) ?? cur : cur));
    } catch (e: any) {
      setIndexError(e?.message ?? "Ma'lumotni yuklab bo'lmadi");
    } finally {
      setIndexLoading(false);
    }
  }, []);

  useEffect(() => { refreshIndex(); }, [refreshIndex]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 280);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpenList(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => searchIndex(index, debounced, 10), [index, debounced]);

  const stats = useMemo(() => {
    const debtors = index.filter((r) => r.debt > 0);
    return {
      students: index.length,
      active: index.filter((r) => r.status_enum === "active").length,
      debtors: debtors.length,
      debtTotal: debtors.reduce((s, r) => s + r.debt, 0),
      paidThisMonth: index.filter((r) => r.paidThisMonth).length,
      noTelegram: index.filter((r) => !r.parent_telegram_chat_id).length,
    };
  }, [index]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 lg:flex lg:flex-wrap lg:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight md:text-3xl">Administrator ish stoli</h1>
          <p className="text-sm text-muted-foreground">O'quvchi qidirish, to'lov olish va bugungi darslar</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            to="/students"
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            <UserPlus className="h-4 w-4" /> Yangi o'quvchi
          </Link>
          <button
            onClick={() => setNewTeacher(true)}
            className="flex items-center gap-2 rounded-xl border border-primary/50 px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary/10"
          >
            <GraduationCap className="h-4 w-4" /> Yangi o'qituvchi
          </button>
          <button
            onClick={() => setPayFor("")}
            className="flex items-center gap-2 rounded-xl border border-primary/50 px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary/10"
          >
            <CreditCard className="h-4 w-4" /> To'lov olish
          </button>
        </div>
      </header>

      {/* Global search */}
      <div ref={boxRef} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpenList(true); }}
          onFocus={() => setOpenList(true)}
          placeholder="O'quvchi ismi, familiyasi, telefon raqami yoki ID orqali qidiring..."
          className="w-full rounded-2xl border border-border bg-card py-4 pl-12 pr-12 text-sm shadow-sm outline-none transition focus:border-primary"
        />
        {indexLoading && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}

        {openList && debounced.trim().length >= 2 && (
          <div className="absolute z-40 mt-2 max-h-[420px] w-full overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-2xl">
            {results.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground">Hech narsa topilmadi</p>
            )}
            {results.map((r) => {
              const meta = STATUS_META[r.status_enum as keyof typeof STATUS_META] ?? { label: r.status_enum, bg: "bg-muted" };
              const pay = r.debt > 0
                ? { text: "Qarzdor", cls: "bg-destructive/15 text-destructive" }
                : r.paidThisMonth
                  ? { text: "To'lovlari to'liq", cls: "bg-green-500/15 text-green-600" }
                  : { text: "To'lov kutilmoqda", cls: "bg-amber-500/20 text-amber-700" };
              return (
                <button
                  key={r.id}
                  onClick={() => { setSelected(r); setOpenList(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-secondary"
                >
                  {r.profile?.avatar_url ? (
                    <img src={r.profile.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" width={40} height={40} loading="lazy" decoding="async" />
                  ) : (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {initialsOf(r.name)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{r.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.phone || r.parent_phone || "telefon yo'q"} · {shortId(r.id)} · {r.groupNames[0] ?? "guruhsiz"}
                    </span>
                  </span>
                  <span className="hidden shrink-0 items-center gap-2 sm:flex">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pay.cls}`}>{pay.text}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${meta.bg}`}>{meta.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {indexError && (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="h-4 w-4" /> {indexError}
          <button onClick={refreshIndex} className="font-semibold underline">Qayta urinish</button>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={Users} label="Faol o'quvchilar" value={`${stats.active} / ${stats.students}`} />
        <Kpi icon={Wallet} label="Shu oy to'lov qilganlar" value={String(stats.paidThisMonth)} tone="ok" />
        <Kpi icon={AlertTriangle} label="Qarzdorlar" value={String(stats.debtors)} tone="bad" />
        <Kpi icon={CreditCard} label="Umumiy qarzdorlik" value={`${fmt(stats.debtTotal)} so'm`} tone="bad" />
      </div>

      {/* Selected student 360 */}
      {selected ? (
        <Student360
          key={selected.id}
          row={selected}
          onPay={(id) => setPayFor(id)}
          onChanged={refreshIndex}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <DebtorsBlock rows={index} onPick={setSelected} onPay={(id) => setPayFor(id)} />
          <TodayLessons />
          <div className="lg:col-span-2">
            <TelegramLinkPanel />
          </div>
        </div>
      )}

      {selected && (
        <button
          onClick={() => setSelected(null)}
          className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:border-primary"
        >
          ← Ish stoliga qaytish
        </button>
      )}

      {newTeacher && <NewTeacherModal onClose={() => setNewTeacher(false)} />}

      {payFor !== null && (
        <PaymentModal
          initialStudentId={payFor || undefined}
          onClose={() => setPayFor(null)}
          onDone={refreshIndex}
        />
      )}
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, tone,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Icon className={`h-5 w-5 ${tone === "ok" ? "text-green-600" : tone === "bad" ? "text-destructive" : "text-primary"}`} />
      <div className="mt-2 truncate text-xl font-extrabold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function DebtorsBlock({
  rows, onPick, onPay,
}: { rows: StudentIndexRow[]; onPick: (r: StudentIndexRow) => void; onPay: (id: string) => void }) {
  const debtors = useMemo(() => rows.filter((r) => r.debt > 0).sort((a, b) => b.debt - a.debt).slice(0, 8), [rows]);
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold"><Wallet className="h-4 w-4 text-primary" /> Qarzdorlar</h2>
        <Link to="/payments" className="text-xs font-semibold text-primary hover:underline">Barchasi</Link>
      </div>
      <div className="mt-3 divide-y divide-border text-sm">
        {debtors.length === 0 && <p className="py-3 text-muted-foreground">Qarzdorlar yo'q</p>}
        {debtors.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 py-2.5">
            <button onClick={() => onPick(r)} className="min-w-0 flex-1 text-left">
              <span className="block truncate font-semibold">{r.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{r.groupNames[0] ?? "guruhsiz"}</span>
            </button>
            <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">
              {fmt(r.debt)} so'm
            </span>
            <button onClick={() => onPay(r.id)} className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
              To'lov
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function TodayLessons() {
  const [rows, setRows] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const dow = new Date().getDay();

  useEffect(() => {
    supabase
      .from("lessons")
      .select("id, group_id, start_time, end_time, group:groups(name, subject:subjects(name)), teacher:profiles!lessons_teacher_user_id_fkey(full_name), room:rooms(name)")
      .eq("day_of_week", dow)
      .eq("is_active", true)
      .order("start_time")
      .then(({ data }) => { setRows((data as never) ?? []); setLoading(false); });
  }, [dow]);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold"><CalendarDays className="h-4 w-4 text-primary" /> Bugungi darslar</h2>
        <Link to="/schedule" className="text-xs font-semibold text-primary hover:underline">Jadval</Link>
      </div>
      <div className="mt-3 divide-y divide-border text-sm">
        {loading && <div className="h-16 animate-pulse rounded-xl bg-secondary/60" />}
        {!loading && rows.length === 0 && <p className="py-3 text-muted-foreground">Bugun dars belgilanmagan</p>}
        {rows.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <div className="truncate font-semibold">
                {l.group?.subject?.name ?? "Fan"} · {l.group?.name ?? "—"}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {l.teacher?.full_name ?? "O'qituvchi yo'q"} · {l.room?.name ?? "xona yo'q"}
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
              <Clock className="h-3 w-3" /> {l.start_time?.slice(0, 5)}–{l.end_time?.slice(0, 5)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
