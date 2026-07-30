import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { bulkImport } from "@/lib/import.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/import")({
  component: ImportPage,
});

type Kind = "students" | "groups" | "teachers" | "payments" | "leads";

const TEMPLATES: Record<Kind, { headers: string[]; sample: Record<string, string | number>[]; label: string }> = {
  students: {
    label: "O'quvchilar",
    headers: ["first_name", "last_name", "parent_full_name", "parent_phone", "group_name", "notes"],
    sample: [
      { first_name: "Ali", last_name: "Valiev", parent_full_name: "Valijon Valiev", parent_phone: "+998901234567", group_name: "English A1", notes: "" },
    ],
  },
  teachers: {
    label: "O'qituvchilar",
    headers: ["full_name", "phone", "subject_name", "group_name", "username", "access_code"],
    sample: [
      { full_name: "Aziz Karimov", phone: "+998901234567", subject_name: "English", group_name: "English A1", username: "", access_code: "" },
    ],
  },
  groups: {
    label: "Guruhlar",
    headers: ["name", "monthly_fee", "schedule"],
    sample: [{ name: "English A1", monthly_fee: 500000, schedule: "Du/Chor/Ju 15:00" }],
  },
  payments: {
    label: "To'lovlar",
    headers: ["student_name", "amount", "period_month", "status", "note"],
    sample: [{ student_name: "Ali Valiev", amount: 500000, period_month: "2026-07", status: "paid", note: "" }],
  },
  leads: {
    label: "Leadlar",
    headers: ["name", "phone", "course", "source", "note"],
    sample: [{ name: "Sardor", phone: "+998901112233", course: "English", source: "instagram", note: "" }],
  },
};

function ImportPage() {
  const [kind, setKind] = useState<Kind>("students");
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [result, setResult] = useState<{
    inserted: number;
    total: number;
    errors: { row: number; message: string }[];
    credentials?: { full_name: string; username: string; access_code: string }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const run = useServerFn(bulkImport);

  function downloadTemplate() {
    const t = TEMPLATES[kind];
    const ws = XLSX.utils.json_to_sheet(t.sample, { header: t.headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t.label);
    XLSX.writeFile(wb, `akhmad-academy-${kind}-shablon.xlsx`);
  }

  async function handleFile(file: File) {
    setResult(null);
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
    setRows(json);
    // Auto-import
    if (json.length > 0) {
      await doImport(json);
    } else {
      toast.error("Faylda ma'lumot topilmadi");
    }
  }

  async function doImport(list: Record<string, any>[]) {
    setBusy(true);
    try {
      const res = await run({ data: { kind, rows: list } });
      setResult(res);
      if (res.inserted > 0) {
        toast.success(`${res.inserted} ta yozuv qo'shildi`);
      }
      if (res.errors.length > 0) {
        toast.warning(`${res.errors.length} ta yozuvda xato`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Import xatosi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Excel importi</h1>
        <p className="text-sm text-muted-foreground">
          Excel yoki CSV faylni tanlang — ma'lumot avtomatik bazaga qo'shiladi. O'quvchilar guruhga, o'qituvchilar fan va guruhga avtomatik biriktiriladi.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Ma'lumot turi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={kind} onValueChange={(v) => { setKind(v as Kind); setRows([]); setResult(null); setFileName(""); }}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TEMPLATES) as Kind[]).map((k) => (
                  <SelectItem key={k} value={k}>{TEMPLATES[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" /> Shablon yuklab olish
            </Button>
          </div>
          <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
            Ustunlar: <span className="font-mono">{TEMPLATES[kind].headers.join(", ")}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Excel faylni tashlang</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-10 text-center transition hover:border-primary hover:bg-muted/40"
          >
            <FileSpreadsheet className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Faylni bu yerga tashlang yoki bosing</p>
            <p className="mt-1 text-xs text-muted-foreground">.xlsx, .xls, .csv — max 5000 qator</p>
            {fileName && <p className="mt-2 text-xs text-primary">{fileName}</p>}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
          {busy && <p className="mt-3 text-sm text-muted-foreground">Yuklanmoqda...</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {result.errors.length === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              Natija
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Jami: <b>{result.total}</b> · Qo'shildi: <b className="text-green-500">{result.inserted}</b> ·
              Xato: <b className="text-amber-500">{result.errors.length}</b>
            </p>
            {result.credentials && result.credentials.length > 0 && (
              <div className="rounded-md border bg-muted/30 p-2">
                <div className="mb-1 text-xs font-semibold">O'qituvchi loginlari (faqat hozir ko'rinadi)</div>
                <div className="max-h-64 overflow-y-auto text-xs">
                  {result.credentials.map((c, i) => (
                    <div key={i} className="flex flex-wrap gap-2 border-b py-1 last:border-0">
                      <span className="font-medium">{c.full_name}</span>
                      <span className="font-mono text-muted-foreground">{c.username}</span>
                      <span className="font-mono text-primary">{c.access_code}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-2 text-xs">
                {result.errors.slice(0, 100).map((e, i) => (
                  <div key={i} className="border-b py-1 last:border-0">
                    <span className="font-mono text-muted-foreground">Qator {e.row}:</span> {e.message}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && !busy && (
        <div className="text-xs text-muted-foreground">
          <Upload className="mr-1 inline h-3 w-3" />
          {rows.length} qator o'qildi
        </div>
      )}
      <Outlet />
    </div>
  );
}
