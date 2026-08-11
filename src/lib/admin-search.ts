import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Normalisation helpers                                               */
/* ------------------------------------------------------------------ */

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "",
  э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

/** Lower-cases, transliterates Cyrillic → Latin and folds Uzbek variants. */
export function normalizeText(input: string): string {
  const lower = (input ?? "").toLowerCase().trim();
  let out = "";
  for (const ch of lower) out += CYR[ch] ?? ch;
  return out
    .replace(/[‘’'`´]/g, "")
    .replace(/o[h]?['`]?/g, "o")
    .replace(/x/g, "h")
    .replace(/ts/g, "s")
    .replace(/\s+/g, " ")
    .trim();
}

/** Last 9 digits of a phone number — matches +998901234567 / 998901234567 / 901234567. */
export function normalizePhone(input: string | null | undefined): string {
  const digits = (input ?? "").replace(/\D+/g, "");
  return digits.length > 9 ? digits.slice(-9) : digits;
}

export const shortId = (id: string) => `AA-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

/* ------------------------------------------------------------------ */
/* Index row                                                           */
/* ------------------------------------------------------------------ */

export type StudentIndexRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  parent_full_name: string | null;
  parent_phone: string | null;
  parent_telegram_chat_id: string | null;
  status_enum: string;
  group_id: string | null;
  profile: { full_name: string | null; phone: string | null; avatar_url: string | null } | null;
  /** derived */
  name: string;
  phone: string;
  groupNames: string[];
  subjectNames: string[];
  debt: number;
  paidThisMonth: boolean;
  haystack: string;
};

export const fullName = (r: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  profile?: { full_name?: string | null } | null;
}) =>
  r.full_name?.trim() ||
  r.profile?.full_name?.trim() ||
  [r.last_name, r.first_name].filter(Boolean).join(" ").trim() ||
  "Ismsiz o'quvchi";

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

/* ------------------------------------------------------------------ */
/* Index loader — one light query set, reused for every keystroke      */
/* ------------------------------------------------------------------ */

/** In-memory cache so repeated mounts/keystrokes reuse one fetch. */
let _cache: { at: number; rows: StudentIndexRow[] } | null = null;
let _inflight: Promise<StudentIndexRow[]> | null = null;
const INDEX_TTL_MS = 120_000;

/** Drop the cache after a mutation so the next read is fresh. */
export function invalidateStudentIndex() {
  _cache = null;
  _inflight = null;
}

export function loadStudentIndex(force = false): Promise<StudentIndexRow[]> {
  if (!force && _cache && Date.now() - _cache.at < INDEX_TTL_MS) return Promise.resolve(_cache.rows);
  if (!force && _inflight) return _inflight;
  _inflight = fetchStudentIndex()
    .then((rows) => {
      _cache = { at: Date.now(), rows };
      return rows;
    })
    .finally(() => {
      _inflight = null;
    });
  return _inflight;
}

async function fetchStudentIndex(): Promise<StudentIndexRow[]> {

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-01`;

  const [{ data: students, error: sErr }, { data: enrolls }, { data: groups }, { data: pays }] =
    await Promise.all([
      supabase
        .from("students")
        .select(
          "id, full_name, first_name, last_name, parent_full_name, parent_phone, parent_telegram_chat_id, status_enum, group_id, profile:profiles(full_name, phone, avatar_url)",
        )
        .limit(2000),
      supabase.from("student_enrollments").select("student_id, group_id").eq("status", "active").limit(5000),
      supabase.from("groups").select("id, name, subject:subjects(name)").limit(1000),
      supabase
        .from("payments")
        .select("student_id, amount, total_amount, status, period_month")
        .or(`status.eq.pending,and(status.eq.paid,period_month.eq.${monthKey})`)
        .limit(10000),

    ]);

  if (sErr) throw sErr;

  const groupMap = new Map<string, { name: string; subject: string | null }>();
  (groups ?? []).forEach((g: any) =>
    groupMap.set(g.id, { name: g.name, subject: g.subject?.name ?? null }),
  );

  const byStudentGroups = new Map<string, Set<string>>();
  (enrolls ?? []).forEach((e: any) => {
    if (e.status && e.status !== "active") return;
    if (!e.group_id) return;
    const set = byStudentGroups.get(e.student_id) ?? new Set<string>();
    set.add(e.group_id);
    byStudentGroups.set(e.student_id, set);
  });

  const debt = new Map<string, number>();
  const paidNow = new Set<string>();
  (pays ?? []).forEach((p: any) => {
    const amount = Number(p.total_amount ?? p.amount ?? 0);
    if (p.status === "pending") debt.set(p.student_id, (debt.get(p.student_id) ?? 0) + amount);
    if (p.status === "paid" && String(p.period_month).slice(0, 10) === monthKey) paidNow.add(p.student_id);
  });

  return (students ?? []).map((s: any) => {
    const gids = new Set(byStudentGroups.get(s.id) ?? []);
    if (s.group_id) gids.add(s.group_id);
    const groupNames: string[] = [];
    const subjectNames: string[] = [];
    gids.forEach((gid) => {
      const g = groupMap.get(gid);
      if (!g) return;
      groupNames.push(g.name);
      if (g.subject) subjectNames.push(g.subject);
    });

    const name = fullName(s);
    const phone = s.profile?.phone ?? "";
    const haystack = normalizeText(
      [
        name,
        s.first_name,
        s.last_name,
        s.parent_full_name,
        shortId(s.id),
        s.id,
        ...groupNames,
        ...subjectNames,
      ]
        .filter(Boolean)
        .join(" "),
    );

    return {
      ...s,
      name,
      phone,
      groupNames,
      subjectNames,
      debt: debt.get(s.id) ?? 0,
      paidThisMonth: paidNow.has(s.id),
      haystack,
    } as StudentIndexRow;
  });
}

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

export function searchIndex(rows: StudentIndexRow[], rawQuery: string, limit = 10): StudentIndexRow[] {
  const q = rawQuery.trim();
  if (q.length < 2) return [];
  const nq = normalizeText(q);
  const digits = q.replace(/\D+/g, "");
  const phoneQ = digits.length >= 4 ? (digits.length > 9 ? digits.slice(-9) : digits) : "";

  const scored: Array<{ row: StudentIndexRow; score: number }> = [];
  for (const row of rows) {
    let score = 0;
    if (phoneQ) {
      const own = normalizePhone(row.phone);
      const par = normalizePhone(row.parent_phone);
      if (own.includes(phoneQ)) score = Math.max(score, 90);
      if (par.includes(phoneQ)) score = Math.max(score, 85);
    }
    if (nq) {
      const name = normalizeText(row.name);
      if (name.startsWith(nq)) score = Math.max(score, 100);
      else if (name.includes(nq)) score = Math.max(score, 80);
      else if (row.haystack.includes(nq)) score = Math.max(score, 60);
    }
    if (score > 0) scored.push({ row, score });
  }
  scored.sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name));
  return scored.slice(0, limit).map((s) => s.row);
}
