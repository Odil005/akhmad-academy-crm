// Shared (client + server) parsing helpers for legacy Excel group lists.
// Columns typically: № | F.I.O | BOSHLAGAN SANASI | SOATI | OTA-ONA NOMERLARI | TO'LOV SUMMASI

export type LegacyField =
  | "ignore"
  | "row_no"
  | "full_name"
  | "start_date"
  | "schedule"
  | "parents"
  | "amount";

export const LEGACY_FIELD_LABELS: Record<LegacyField, string> = {
  ignore: "— e'tiborsiz —",
  row_no: "№ (qator raqami)",
  full_name: "F.I.O (to'liq ism)",
  start_date: "Boshlagan sanasi",
  schedule: "Soati / jadval",
  parents: "Ota-ona nomerlari",
  amount: "To'lov summasi",
};

const norm = (s: string) =>
  s
    .toString()
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/ў/g, "o'")
    .replace(/[\s._\-]+/g, " ")
    .trim();

const HEADER_PATTERNS: { field: LegacyField; tests: RegExp[] }[] = [
  { field: "full_name", tests: [/^f ?i ?o$/, /^fio$/, /f\.?\s?i\.?\s?o/, /ism ?familiya/, /familiya/, /o'?quvchi/, /talaba/, /student/, /full ?name/, /name/] },
  { field: "start_date", tests: [/boshla/, /sana/, /kelgan/, /date/, /start/] },
  { field: "schedule", tests: [/soat/, /kun/, /jadval/, /schedule/, /vaqt/, /time/] },
  { field: "parents", tests: [/ota ?ona/, /ota-?ona/, /parent/, /nomer/, /raqam/, /telefon/, /tel$/, /phone/] },
  { field: "amount", tests: [/to'?lov/, /summa/, /narx/, /amount/, /payment/, /fee/, /price/] },
  { field: "row_no", tests: [/^n[o°]?$/, /^№$/, /^#$/, /^t ?r$/, /tartib/] },
];

export function detectField(header: string): LegacyField {
  const h = norm(header);
  if (!h) return "ignore";
  for (const { field, tests } of HEADER_PATTERNS) {
    if (tests.some((re) => re.test(h))) return field;
  }
  return "ignore";
}

/** Detect mapping for a whole header row, avoiding duplicate field assignment. */
export function detectMapping(headers: string[]): LegacyField[] {
  const used = new Set<LegacyField>();
  return headers.map((h) => {
    const f = detectField(h);
    if (f === "ignore" || f === "row_no") return f;
    if (used.has(f)) return "ignore";
    used.add(f);
    return f;
  });
}

/* ---------------- name ---------------- */

export function splitFullName(full: string): { first_name: string; last_name: string } {
  const parts = full.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0]!, last_name: "" };
  // First word = surname (legacy lists), remainder = given name(s).
  return { last_name: parts[0]!, first_name: parts.slice(1).join(" ") };
}

/* ---------------- phones ---------------- */

const UZ_PHONE_RE = /(?:\+?998)?[\s(\-]*(\d{2})[\s)\-]*(\d{3})[\s\-]*(\d{2})[\s\-]*(\d{2})/g;

export function extractPhones(raw: unknown): string[] {
  const text = String(raw ?? "");
  const out: string[] = [];
  const digitsOnly = text.replace(/[^\d+\s()\-]/g, " ");
  let m: RegExpExecArray | null;
  UZ_PHONE_RE.lastIndex = 0;
  while ((m = UZ_PHONE_RE.exec(digitsOnly)) !== null) {
    const phone = `+998${m[1]}${m[2]}${m[3]}${m[4]}`;
    if (!out.includes(phone)) out.push(phone);
  }
  return out;
}

export function extractParentName(raw: unknown): string {
  const text = String(raw ?? "");
  const cleaned = text
    .replace(/[\d+()]/g, " ")
    .replace(/[,;\/|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 1 ? cleaned : "";
}

/* ---------------- amount ---------------- */

export function parseAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  const text = String(raw).replace(/[^\d.,\s]/g, "").trim();
  if (!text) return null;
  // Treat . , and spaces as thousand separators (250,000 / 250.000 / 250 000).
  const digits = text.replace(/[.,\s]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/* ---------------- date ---------------- */

const MONTHS: Record<string, number> = {
  yanvar: 1, january: 1, jan: 1, январь: 1, yan: 1,
  fevral: 2, february: 2, feb: 2, февраль: 2, fev: 2,
  mart: 3, march: 3, mar: 3, март: 3,
  aprel: 4, april: 4, apr: 4, апрель: 4,
  may: 5, мая: 5, mayo: 5,
  iyun: 6, june: 6, jun: 6, июнь: 6,
  iyul: 7, july: 7, jul: 7, июль: 7,
  avgust: 8, august: 8, aug: 8, август: 8, avg: 8,
  sentyabr: 9, sentabr: 9, september: 9, sep: 9, sent: 9, сентябрь: 9,
  oktyabr: 10, oktabr: 10, october: 10, oct: 10, okt: 10, октябрь: 10,
  noyabr: 11, november: 11, nov: 11, ноябрь: 11,
  dekabr: 12, december: 12, dec: 12, dek: 12, декабрь: 12,
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Excel serial date → ISO. */
function excelSerialToISO(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 60000) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export type ParsedDate = { iso: string | null; needsYear: boolean; raw: string };

/**
 * Accepts "10 sentyabr", "15.09.2026", Excel serial, Date, ISO text.
 * `academicYearStart` is used when the source has no year.
 */
export function parseStartDate(raw: unknown, academicYearStart?: number): ParsedDate {
  const rawText = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw ?? "").trim();
  if (!rawText) return { iso: null, needsYear: false, raw: "" };

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return { iso: raw.toISOString().slice(0, 10), needsYear: false, raw: rawText };
  }
  if (typeof raw === "number") {
    const iso = excelSerialToISO(raw);
    if (iso) return { iso, needsYear: false, raw: rawText };
  }

  const text = rawText.replace(/[’‘`´]/g, "'").toLowerCase();

  // dd.mm.yyyy | dd/mm/yy | yyyy-mm-dd
  const iso = text.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (iso) return { iso: `${iso[1]}-${pad(+iso[2]!)}-${pad(+iso[3]!)}`, needsYear: false, raw: rawText };

  const dmy = text.match(/^(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?$/);
  if (dmy) {
    const day = +dmy[1]!;
    const month = +dmy[2]!;
    if (dmy[3]) {
      let year = +dmy[3];
      if (year < 100) year += 2000;
      return { iso: `${year}-${pad(month)}-${pad(day)}`, needsYear: false, raw: rawText };
    }
    const y = yearFor(month, academicYearStart);
    return { iso: y ? `${y}-${pad(month)}-${pad(day)}` : null, needsYear: !y, raw: rawText };
  }

  // "10 sentyabr" / "sentyabr 10" / "10 sentyabr 2026"
  const words = text.replace(/[,]/g, " ").split(/\s+/).filter(Boolean);
  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;
  for (const w of words) {
    const n = Number(w.replace(/[^\d]/g, ""));
    if (/^\d{4}$/.test(w)) { year = n; continue; }
    if (/^\d{1,2}$/.test(w.replace(/[^\d]/g, "")) && Number.isFinite(n) && n >= 1 && n <= 31 && day === null) {
      day = n;
      continue;
    }
    const key = Object.keys(MONTHS).find((k) => w.startsWith(k.slice(0, 4)) && k.length >= 3);
    if (key && month === null) month = MONTHS[key]!;
  }
  if (day !== null && month !== null) {
    const y = year ?? yearFor(month, academicYearStart);
    return { iso: y ? `${y}-${pad(month)}-${pad(day)}` : null, needsYear: !y, raw: rawText };
  }
  return { iso: null, needsYear: false, raw: rawText };
}

/** Academic year starting in Sept: months 9..12 → start year, 1..8 → start year + 1. */
function yearFor(month: number, academicYearStart?: number): number | null {
  if (!academicYearStart) return null;
  return month >= 9 ? academicYearStart : academicYearStart + 1;
}

/* ---------------- schedule ---------------- */

export type ParsedSchedule = {
  raw: string;
  schedule_type: string | null;
  subject_name: string | null;
  lesson_time: string | null;
};

const SCHEDULE_TYPES: { re: RegExp; value: string }[] = [
  { re: /toq\s*kun/, value: "toq kun" },
  { re: /juft\s*kun/, value: "juft kun" },
  { re: /har\s*kun/, value: "har kuni" },
  { re: /dam\s*olish|shanba|yakshanba/, value: "dam olish kunlari" },
];

export function parseSchedule(raw: unknown): ParsedSchedule {
  const rawText = String(raw ?? "").trim();
  if (!rawText) return { raw: "", schedule_type: null, subject_name: null, lesson_time: null };
  const text = rawText.replace(/[’‘`´]/g, "'").toLowerCase();

  let scheduleType: string | null = null;
  let rest = text;
  for (const { re, value } of SCHEDULE_TYPES) {
    const m = rest.match(re);
    if (m) {
      scheduleType = value;
      rest = rest.replace(re, " ");
      break;
    }
  }

  const timeMatch = rest.match(/(\d{1,2})\s*[:.]\s*(\d{2})/) ?? rest.match(/\b(\d{1,2})\s*(?:soat|00)\b/);
  let lessonTime: string | null = null;
  if (timeMatch) {
    const h = Number(timeMatch[1]);
    const min = timeMatch[2] && /^\d{2}$/.test(timeMatch[2]) ? timeMatch[2] : "00";
    if (h >= 0 && h <= 23) lessonTime = `${pad(h)}:${min}`;
    rest = rest.replace(timeMatch[0], " ");
  }

  const subject = rest
    .replace(/[\d:.\-/]+/g, " ")
    .replace(/\b(kun|kuni|soat|soati|dars)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    raw: rawText,
    schedule_type: scheduleType,
    subject_name: subject.length > 1 ? subject : null,
    lesson_time: lessonTime,
  };
}

/* ---------------- row parsing ---------------- */

export type ParsedStudentRow = {
  index: number;
  full_name: string;
  first_name: string;
  last_name: string;
  start_date: string | null;
  start_date_raw: string;
  schedule_raw: string;
  schedule_type: string | null;
  subject_name: string | null;
  lesson_time: string | null;
  parent_full_name: string;
  parent_phones: string[];
  monthly_fee: number | null;
  warnings: string[];
  errors: string[];
};

export type RawSheet = { headers: string[]; rows: unknown[][] };

/** Pick the header row heuristically, tolerating title/merged rows on top. */
export function toSheet(matrix: unknown[][]): RawSheet {
  const nonEmpty = matrix.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
  let headerIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(nonEmpty.length, 10); i++) {
    const row = nonEmpty[i]!.map((c) => String(c ?? ""));
    const score = row.reduce((acc, c) => acc + (detectField(c) !== "ignore" ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; headerIdx = i; }
  }
  if (bestScore < 2) {
    return { headers: (nonEmpty[0] ?? []).map((c) => String(c ?? "")), rows: nonEmpty.slice(1) };
  }
  return {
    headers: nonEmpty[headerIdx]!.map((c) => String(c ?? "")),
    rows: nonEmpty.slice(headerIdx + 1),
  };
}

export function parseRows(
  sheet: RawSheet,
  mapping: LegacyField[],
  opts: { academicYearStart?: number } = {},
): ParsedStudentRow[] {
  const col = (field: LegacyField) => mapping.indexOf(field);
  const iName = col("full_name");
  const iDate = col("start_date");
  const iSched = col("schedule");
  const iParents = col("parents");
  const iAmount = col("amount");

  const out: ParsedStudentRow[] = [];
  sheet.rows.forEach((row, idx) => {
    const cell = (i: number) => (i >= 0 ? row[i] : undefined);
    const fullRaw = String(cell(iName) ?? "").replace(/\s+/g, " ").trim();
    const hasAny = row.some((c) => String(c ?? "").trim() !== "");
    if (!hasAny) return; // skip blank rows entirely

    const warnings: string[] = [];
    const errors: string[] = [];
    if (!fullRaw) errors.push("F.I.O topilmadi");

    const { first_name, last_name } = splitFullName(fullRaw);
    const d = parseStartDate(cell(iDate), opts.academicYearStart);
    if (d.raw && !d.iso) warnings.push(d.needsYear ? "Sana yili aniqlanmadi" : "Sana o'qilmadi");

    const sched = parseSchedule(cell(iSched));
    if (!sched.raw) warnings.push("Jadval (soati) ko'rsatilmagan");

    const phones = extractPhones(cell(iParents));
    const parentName = extractParentName(cell(iParents));
    if (iParents >= 0 && String(cell(iParents) ?? "").trim() && phones.length === 0) {
      warnings.push("Telefon raqami aniqlanmadi");
    }

    const fee = parseAmount(cell(iAmount));

    out.push({
      index: idx,
      full_name: fullRaw,
      first_name,
      last_name,
      start_date: d.iso,
      start_date_raw: d.raw,
      schedule_raw: sched.raw,
      schedule_type: sched.schedule_type,
      subject_name: sched.subject_name,
      lesson_time: sched.lesson_time,
      parent_full_name: parentName,
      parent_phones: phones,
      monthly_fee: fee,
      warnings,
      errors,
    });
  });
  return out;
}
