import { createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet, FileText, Download } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/reports")({
  component: ReportsSettings,
});

type Row = Record<string, string | number | null>;

async function fetchDataset(kind: string): Promise<{ title: string; rows: Row[] }> {
  if (kind === "students") {
    const { data, error } = await supabase
      .from("students")
      .select("first_name, last_name, phone, parent_phone, status_enum, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return {
      title: "O'quvchilar",
      rows: (data ?? []).map((s: any) => ({
        Ism: s.first_name ?? "",
        Familiya: s.last_name ?? "",
        Telefon: s.phone ?? "",
        "Ota-ona tel": s.parent_phone ?? "",
        Holat: s.status_enum ?? "",
        "Qo'shildi": s.created_at ? new Date(s.created_at).toLocaleDateString() : "",
      })),
    };
  }
  if (kind === "payments") {
    const { data, error } = await supabase
      .from("payments")
      .select("amount, status, period_month, paid_at, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return {
      title: "To'lovlar",
      rows: (data ?? []).map((p: any) => ({
        Summa: Number(p.amount) || 0,
        Holat: p.status ?? "",
        Oy: p.period_month ?? "",
        "To'landi": p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "",
        Yaratildi: p.created_at ? new Date(p.created_at).toLocaleDateString() : "",
      })),
    };
  }
  if (kind === "attendance") {
    const { data, error } = await supabase
      .from("attendance")
      .select("date, status, student_id, lesson_id")
      .order("date", { ascending: false })
      .limit(2000);
    if (error) throw error;
    return {
      title: "Davomat",
      rows: (data ?? []).map((a: any) => ({
        Sana: a.date ?? "",
        Holat: a.status ?? "",
        "O'quvchi ID": a.student_id ?? "",
        "Dars ID": a.lesson_id ?? "",
      })),
    };
  }
  if (kind === "groups") {
    const { data, error } = await supabase.from("groups").select("name, subject_id, teacher_user_id, is_active, created_at").order("created_at", { ascending: false });
    if (error) throw error;
    return {
      title: "Guruhlar",
      rows: (data ?? []).map((g: any) => ({
        Nomi: g.name ?? "",
        "Fan ID": g.subject_id ?? "",
        "O'qituvchi ID": g.teacher_user_id ?? "",
        Faol: g.is_active ? "Ha" : "Yo'q",
        Yaratildi: g.created_at ? new Date(g.created_at).toLocaleDateString() : "",
      })),
    };
  }
  throw new Error("Noma'lum hisobot turi");
}

async function exportExcel(title: string, rows: Row[]) {
  if (!rows.length) {
    toast.warning("Ma'lumot yo'q");
    return;
  }
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 30));
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${title}-${stamp}.xlsx`);
}

async function exportWord(title: string, rows: Row[]) {
  if (!rows.length) {
    toast.warning("Ma'lumot yo'q");
    return;
  }
  const headers = Object.keys(rows[0]);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (h) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
        })
    ),
  });
  const dataRows = rows.map(
    (r) =>
      new TableRow({
        children: headers.map(
          (h) =>
            new TableCell({
              children: [new Paragraph(String(r[h] ?? ""))],
            })
        ),
      })
  );
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: `${title} hisoboti`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Sana: ${new Date().toLocaleDateString()} · Jami: ${rows.length}`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph(""),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...dataRows],
          }),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  const stamp = new Date().toISOString().slice(0, 10);
  saveAs(blob, `${title}-${stamp}.docx`);
}

const DATASETS = [
  { key: "students", label: "O'quvchilar" },
  { key: "payments", label: "To'lovlar" },
  { key: "attendance", label: "Davomat" },
  { key: "groups", label: "Guruhlar" },
];

function ReportsSettings() {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (kind: string, format: "xlsx" | "docx") => {
    setBusy(`${kind}-${format}`);
    try {
      const { title, rows } = await fetchDataset(kind);
      if (format === "xlsx") exportExcel(title, rows);
      else await exportWord(title, rows);
      toast.success(`${title} yuklab olindi`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Excel & Word hisobotlar</h2>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Kerakli hisobotni tanlang va formatda yuklab oling. Fayllar to'g'ridan-to'g'ri brauzerda tayyorlanadi.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {DATASETS.map((d) => (
          <div key={d.key} className="rounded-xl border border-border bg-background p-4">
            <div className="mb-3 font-semibold">{d.label}</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => run(d.key, "xlsx")}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy === `${d.key}-xlsx` ? "..." : <><FileSpreadsheet className="h-4 w-4" /> Excel</>}
              </button>
              <button
                onClick={() => run(d.key, "docx")}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-primary/60 px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary/10 disabled:opacity-60"
              >
                {busy === `${d.key}-docx` ? "..." : <><FileText className="h-4 w-4" /> Word</>}
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Download className="h-3.5 w-3.5" /> Fayl nomi avtomatik sanaga qarab shakllanadi.
      </p>
    </div>
  );
}
