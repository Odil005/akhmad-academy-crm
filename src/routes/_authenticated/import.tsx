import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { importLegacyStudents, listImportBatches, undoImportBatch } from "@/lib/import-legacy.functions";
import { importTeachers } from "@/lib/import-teachers.functions";
import {
  LEGACY_FIELD_LABELS,
  TEACHER_FIELDS,
  TEACHER_FIELD_LABELS,
  detectMapping,
  detectTeacherMapping,
  parseRows,
  parseTeacherRows,
  toSheet,
  type LegacyField,
  type ParsedStudentRow,
  type ParsedTeacherRow,
  type RawSheet,
  type TeacherField,
} from "@/lib/import-parse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Undo2, AlertTriangle, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/import")({
  component: ImportTabsPage,
  head: () => ({
    meta: [
      { title: "Excel import — Akhmad Academy CRM" },
      { name: "description", content: "Guruh ro'yxatlarini eski Excel formatida import qilish." },
    ],
  }),
});

const FIELDS: LegacyField[] = ["ignore", "row_no", "full_name", "start_date", "birth_date", "schedule", "parents", "amount"];

function academicYears(): string[] {
  const now = new Date().getFullYear();
  return [now - 2, now - 1, now, now + 1].map((y) => `${y}-${y + 1}`);
}

type Subject = { id: string; name: string };
type Group = { id: string; name: string; subject_id: string | null; teacher_id: string | null };
type Teacher = { id: string; full_name: string | null };

function ImportTabsPage() {
  const [tab, setTab] = useState<"students" | "teachers">("students");
  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-xl border border-border p-1">
        {([["students", "O'quvchilar"], ["teachers", "O'qituvchilar"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "students" ? <ImportPage /> : <TeacherImport />}
    </div>
  );
}

function ImportPage() {
  const runImport = useServerFn(importLegacyStudents);
  const runUndo = useServerFn(undoImportBatch);
  const loadBatches = useServerFn(listImportBatches);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [year, setYear] = useState(academicYears()[2]!);
  const [newGroupName, setNewGroupName] = useState("");

  const [sheet, setSheet] = useState<RawSheet | null>(null);
  const [mapping, setMapping] = useState<LegacyField[]>([]);
  const [fileName, setFileName] = useState("");
  const [dupStrategy, setDupStrategy] = useState<"skip" | "update" | "create">("skip");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof importLegacyStudents>> | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const [s, g, p, r] = await Promise.all([
        supabase.from("subjects").select("id, name").order("name"),
        supabase.from("groups").select("id, name, subject_id, teacher_id").order("name"),
        supabase.from("profiles").select("id, full_name").order("full_name"),
        supabase.from("user_roles").select("user_id, role").eq("role", "teacher"),
      ]);
      setSubjects(s.data ?? []);
      setGroups((g.data ?? []) as Group[]);
      const teacherIds = new Set((r.data ?? []).map((x: any) => x.user_id));
      setTeachers((p.data ?? []).filter((x: any) => teacherIds.has(x.id)) as Teacher[]);
      const b = await loadBatches();
      setBatches(b.items ?? []);
    })();
  }, [loadBatches]);

  const yearStart = Number(year.slice(0, 4));
  const parsed: ParsedStudentRow[] = useMemo(
    () => (sheet ? parseRows(sheet, mapping, { academicYearStart: yearStart }) : []),
    [sheet, mapping, yearStart],
  );

  const stats = useMemo(() => {
    const errors = parsed.filter((r) => r.errors.length).length;
    const warns = parsed.filter((r) => !r.errors.length && r.warnings.length).length;
    return { total: parsed.length, errors, warns, ok: parsed.length - errors };
  }, [parsed]);

  const groupOptions = subjectId ? groups.filter((g) => g.subject_id === subjectId) : groups;
  const selectedGroup = groups.find((g) => g.id === groupId) ?? null;

  async function handleFile(file: File) {
    setResult(null);
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "array", cellDates: true, codepage: 65001 });
    const ws = wb.Sheets[wb.SheetNames[0]!];
    if (!ws) return toast.error("Faylda varaq topilmadi");
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false, blankrows: false });
    const s = toSheet(matrix as unknown[][]);
    if (!s.rows.length) return toast.error("Faylda ma'lumot topilmadi");
    setSheet(s);
    setMapping(detectMapping(s.headers));
    toast.success(`${s.rows.length} qator o'qildi`);
  }

  async function createGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("groups")
      .insert({ name, subject_id: subjectId || null, teacher_id: teacherId || null, monthly_fee: 0 })
      .select("id, name, subject_id, teacher_id")
      .single();
    if (error) return toast.error(error.message);
    setGroups((g) => [...g, data as Group]);
    setGroupId(data!.id);
    setNewGroupName("");
    toast.success("Guruh yaratildi");
  }

  async function doImport() {
    if (!groupId) return toast.error("Avval guruhni tanlang");
    const rows = parsed.filter((r) => !r.errors.length);
    if (!rows.length) return toast.error("Import uchun to'g'ri qator yo'q");
    setBusy(true);
    try {
      // Keep the teacher/subject binding of the chosen group in sync.
      if (teacherId && selectedGroup && selectedGroup.teacher_id !== teacherId) {
        await supabase.from("groups").update({ teacher_id: teacherId }).eq("id", groupId);
      }
      const res = await runImport({
        data: {
          file_name: fileName,
          group_id: groupId,
          academic_year: year,
          duplicate_strategy: dupStrategy,
          rows: rows.map((r) => ({
            full_name: r.full_name,
            start_date: r.start_date,
            start_date_raw: r.start_date_raw,
            schedule_raw: r.schedule_raw,
            schedule_type: r.schedule_type,
            subject_name: r.subject_name,
            lesson_time: r.lesson_time,
            parent_full_name: r.parent_full_name,
            parent_phones: r.parent_phones,
            birth_date: r.birth_date,
            monthly_fee: r.monthly_fee,
          })),
        },
      });
      setResult(res);
      const b = await loadBatches();
      setBatches(b.items ?? []);
      toast.success(`${res.inserted} o'quvchi qo'shildi`);
    } catch (e) {
      const msg = e instanceof Response ? await e.text() : (e as Error).message;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function undo(id: string) {
    setBusy(true);
    try {
      const res = await runUndo({ data: { batch_id: id } });
      toast.success(`${res.removed} yozuv qaytarildi`);
      const b = await loadBatches();
      setBatches(b.items ?? []);
    } catch (e) {
      const msg = e instanceof Response ? await e.text() : (e as Error).message;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Excel import</h1>
        <p className="text-sm text-muted-foreground">
          Eski guruh ro'yxatlari (№, F.I.O, boshlagan sanasi, soati, ota-ona nomerlari, to'lov summasi) qo'llab-quvvatlanadi.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">1. Guruhni tanlang (majburiy)</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Fan</div>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder="Fan" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Guruh</div>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger><SelectValue placeholder="Guruh" /></SelectTrigger>
              <SelectContent>
                {groupOptions.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="mt-2 flex gap-2">
              <Input placeholder="Yangi guruh nomi" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
              <Button variant="outline" onClick={createGroup} disabled={!newGroupName.trim()}>+</Button>
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">O'qituvchi</div>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger><SelectValue placeholder="O'qituvchi" /></SelectTrigger>
              <SelectContent>
                {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name ?? t.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">O'quv yili</div>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {academicYears().map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">2. Faylni yuklang (.xlsx, .xls, .csv)</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
          />
          <Button onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Fayl tanlash</Button>
          {fileName && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" /> {fileName}
            </span>
          )}
        </CardContent>
      </Card>

      {sheet && (
        <Card>
          <CardHeader><CardTitle className="text-base">3. Ustunlarni moslashtirish</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {sheet.headers.map((h, i) => (
              <div key={i}>
                <div className="mb-1 truncate text-xs font-medium text-muted-foreground">{h || `Ustun ${i + 1}`}</div>
                <Select
                  value={mapping[i] ?? "ignore"}
                  onValueChange={(v) => setMapping((m) => m.map((x, j) => (j === i ? (v as LegacyField) : x)))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELDS.map((f) => <SelectItem key={f} value={f}>{LEGACY_FIELD_LABELS[f]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {parsed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              4. Ko'rib chiqish — {stats.total} qator · {stats.ok} to'g'ri · {stats.warns} ogohlantirish · {stats.errors} xato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Dublikat topilsa</div>
                <Select value={dupStrategy} onValueChange={(v) => setDupStrategy(v as typeof dupStrategy)}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">O'tkazib yuborish</SelectItem>
                    <SelectItem value="update">Mavjudni yangilash</SelectItem>
                    <SelectItem value="create">Yangi o'quvchi sifatida qo'shish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={doImport} disabled={busy || !groupId}>Import qilish</Button>
              {!groupId && (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> Guruhni tanlang
                </span>
              )}
            </div>

            <div className="max-h-[460px] overflow-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-xs uppercase">
                  <tr>
                    {["#", "O'quvchi", "Boshlagan", "Tug'ilgan", "Jadval / fan", "Ota-ona", "Telefonlar", "Summa", "Guruh", "Holat"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((r, i) => (
                    <tr key={i} className={`border-t border-border ${r.errors.length ? "bg-destructive/10" : ""}`}>
                      <td className="px-3 py-1.5">{i + 1}</td>
                      <td className="px-3 py-1.5 font-medium">{r.full_name || "—"}</td>
                      <td className="px-3 py-1.5">{r.start_date ?? (r.start_date_raw || "—")}</td>
                      <td className="px-3 py-1.5">{r.birth_date ?? (r.birth_date_raw || "—")}</td>
                      <td className="px-3 py-1.5">
                        {[r.schedule_type, r.subject_name, r.lesson_time].filter(Boolean).join(" · ") || r.schedule_raw || "—"}
                      </td>
                      <td className="px-3 py-1.5">{r.parent_full_name || "—"}</td>
                      <td className="px-3 py-1.5">{r.parent_phones.join(", ") || "—"}</td>
                      <td className="px-3 py-1.5">{r.monthly_fee?.toLocaleString("uz-UZ") ?? "—"}</td>
                      <td className="px-3 py-1.5">{selectedGroup?.name ?? "—"}</td>
                      <td className="px-3 py-1.5 text-xs">
                        {r.errors.length ? (
                          <span className="text-destructive">{r.errors.join("; ")}</span>
                        ) : r.warnings.length ? (
                          <span className="text-amber-600">{r.warnings.join("; ")}</span>
                        ) : (
                          <span className="text-emerald-600">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader><CardTitle className="text-base">Import natijasi</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              {[
                ["Jami", result.total],
                ["Qo'shildi", result.inserted],
                ["Yangilandi", result.updated],
                ["Dublikat", result.duplicates],
                ["Ogohlantirish", result.warnings],
                ["Xato", result.errors],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-border p-3">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-xl font-bold">{value}</div>
                </div>
              ))}
            </div>
            {result.details.length > 0 && (
              <ul className="max-h-48 space-y-1 overflow-auto text-xs text-muted-foreground">
                {result.details.map((d, i) => <li key={i}>#{d.row} · {d.level} · {d.message}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {batches.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Import tarixi (undo)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {batches.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm">
                <span className="font-medium">{b.file_name || "fayl"}</span>
                <span className="text-xs text-muted-foreground">{b.academic_year}</span>
                <span className="text-xs text-muted-foreground">
                  jami {b.total} · qo'shildi {b.inserted} · yangilandi {b.updated} · xato {b.errors}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(b.created_at).toLocaleString("uz-UZ")}
                </span>
                {b.undone_at ? (
                  <span className="text-xs text-muted-foreground">qaytarilgan</span>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => undo(b.id)}>
                    <Undo2 className="mr-1 h-3.5 w-3.5" /> Qaytarish
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TeacherImport() {
  const run = useServerFn(importTeachers);
  const [sheet, setSheet] = useState<RawSheet | null>(null);
  const [mapping, setMapping] = useState<TeacherField[]>([]);
  const [fileName, setFileName] = useState("");
  const [createLogins, setCreateLogins] = useState(true);
  const [createGroups, setCreateGroups] = useState(true);
  const [monthlyFee, setMonthlyFee] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof importTeachers>> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed: ParsedTeacherRow[] = useMemo(
    () => (sheet ? parseTeacherRows(sheet, mapping) : []),
    [sheet, mapping],
  );
  const okRows = parsed.filter((r) => !r.errors.length);

  async function handleFile(file: File) {
    setResult(null);
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "array", cellDates: true, codepage: 65001 });
    const ws = wb.Sheets[wb.SheetNames[0]!];
    if (!ws) return toast.error("Faylda varaq topilmadi");
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false, blankrows: false });
    const s = toSheet(matrix as unknown[][]);
    if (!s.rows.length) return toast.error("Faylda ma'lumot topilmadi");
    setSheet(s);
    setMapping(detectTeacherMapping(s.headers));
    toast.success(`${s.rows.length} qator o'qildi`);
  }

  async function doImport() {
    if (!okRows.length) return toast.error("Import uchun to'g'ri qator yo'q");
    setBusy(true);
    try {
      const res = await run({
        data: {
          file_name: fileName,
          create_logins: createLogins,
          create_groups: createGroups,
          monthly_fee: monthlyFee,
          rows: okRows.map((r) => ({
            full_name: r.full_name,
            first_name: r.first_name,
            last_name: r.last_name,
            phone: r.phone,
            subject_name: r.subject_name,
            group_name: r.group_name,
            birth_date: r.birth_date,
          })),
        },
      });
      setResult(res);
      toast.success(`${res.inserted} o'qituvchi qo'shildi · ${res.groups_created} guruh yaratildi`);
    } catch (e) {
      const msg = e instanceof Response ? await e.text() : (e as Error).message;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">O'qituvchilar importi</h1>
        <p className="text-sm text-muted-foreground">
          F.I.O, telefon, fan, guruh, tug'ilgan sana ustunlari qo'llab-quvvatlanadi. Har bir o'qituvchi uchun login/parol avtomatik yaratiladi va guruh ochiladi.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">1. Faylni yuklang (.xlsx, .xls, .csv)</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
          />
          <Button onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Fayl tanlash</Button>
          {fileName && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" /> {fileName}
            </span>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={createLogins} onChange={(e) => setCreateLogins(e.target.checked)} />
            Login/parol yaratish
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={createGroups} onChange={(e) => setCreateGroups(e.target.checked)} />
            Guruh ochish
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Guruh oylik to'lovi</span>
            <Input
              type="number"
              className="w-32"
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      {sheet && (
        <Card>
          <CardHeader><CardTitle className="text-base">2. Ustunlarni moslashtirish</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {sheet.headers.map((h, i) => (
              <div key={i}>
                <div className="mb-1 truncate text-xs font-medium text-muted-foreground">{h || `Ustun ${i + 1}`}</div>
                <Select
                  value={mapping[i] ?? "ignore"}
                  onValueChange={(v) => setMapping((m) => m.map((x, j) => (j === i ? (v as TeacherField) : x)))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEACHER_FIELDS.map((f) => <SelectItem key={f} value={f}>{TEACHER_FIELD_LABELS[f]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {parsed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              3. Ko'rib chiqish — {parsed.length} qator · {okRows.length} to'g'ri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={doImport} disabled={busy || !okRows.length}>Import qilish</Button>
              {!okRows.length && (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> To'g'ri qator yo'q
                </span>
              )}
            </div>
            <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-xs uppercase">
                  <tr>
                    {["#", "O'qituvchi", "Telefon", "Fan", "Guruh", "Tug'ilgan", "Holat"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((r, i) => (
                    <tr key={i} className={`border-t border-border ${r.errors.length ? "bg-destructive/10" : ""}`}>
                      <td className="px-3 py-1.5">{i + 1}</td>
                      <td className="px-3 py-1.5 font-medium">{r.full_name || "—"}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{r.phone ?? "—"}</td>
                      <td className="px-3 py-1.5">{r.subject_name ?? "—"}</td>
                      <td className="px-3 py-1.5">{r.group_name ?? "—"}</td>
                      <td className="px-3 py-1.5">{r.birth_date ?? "—"}</td>
                      <td className="px-3 py-1.5 text-xs">
                        {r.errors.length ? (
                          <span className="text-destructive">{r.errors.join("; ")}</span>
                        ) : r.warnings.length ? (
                          <span className="text-amber-600">{r.warnings.join("; ")}</span>
                        ) : (
                          <span className="text-emerald-600">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader><CardTitle className="text-base">Natija</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Jami", result.total],
                ["Qo'shildi", result.inserted],
                ["Guruh yaratildi", result.groups_created],
                ["Xato", result.errors],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-border p-3">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-xl font-bold">{value}</div>
                </div>
              ))}
            </div>

            {result.credentials.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold">Login ma'lumotlari (bir marta ko'rsatiladi)</div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const text = result.credentials
                        .map((c) => `${c.full_name}\t${c.username}\t${c.access_code}`)
                        .join("\n");
                      void navigator.clipboard.writeText(text);
                      toast.success("Nusxalandi");
                    }}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" /> Hammasini nusxalash
                  </Button>
                </div>
                <div className="max-h-64 overflow-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted text-xs uppercase">
                      <tr>
                        {["O'qituvchi", "Login", "Parol"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.credentials.map((c) => (
                        <tr key={c.username} className="border-t border-border">
                          <td className="px-3 py-1.5">{c.full_name}</td>
                          <td className="px-3 py-1.5 font-mono">{c.username}</td>
                          <td className="px-3 py-1.5 font-mono">{c.access_code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.details.length > 0 && (
              <ul className="max-h-48 space-y-1 overflow-auto text-xs text-muted-foreground">
                {result.details.map((d, i) => <li key={i}>#{d.row} · {d.level} · {d.message}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
