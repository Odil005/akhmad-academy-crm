import { useEffect, useState } from "react";
import { Cake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = { id: string; name: string; group: string | null; date: string; inDays: number; phone: string | null };

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr",
];

/** Students whose birthday falls within the next 3 days (reminder window). */
export function BirthdayReminders({ days = 3 }: { days?: number }) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("students")
        .select("id, full_name, first_name, last_name, birth_date, parent_phone, group:groups(name)")
        .not("birth_date", "is", null);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const out: Row[] = [];
      for (const s of (data ?? []) as any[]) {
        const bd = new Date(s.birth_date);
        if (Number.isNaN(bd.getTime())) continue;
        let next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        if (next < today) next = new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate());
        const inDays = Math.round((next.getTime() - today.getTime()) / 86400000);
        if (inDays > days) continue;
        out.push({
          id: s.id,
          name: s.full_name || `${s.last_name ?? ""} ${s.first_name ?? ""}`.trim() || "—",
          group: s.group?.name ?? null,
          date: `${bd.getDate()} ${MONTHS[bd.getMonth()]}`,
          inDays,
          phone: s.parent_phone ?? null,
        });
      }
      out.sort((a, b) => a.inDays - b.inDays);
      setRows(out);
    })();
  }, [days]);

  if (!rows.length) return null;

  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Cake className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold">Tug'ilgan kun eslatmasi ({days} kun ichida)</h2>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-card p-3">
            <div className="text-sm font-semibold">{r.name}</div>
            <div className="text-xs text-muted-foreground">
              {r.date} · {r.inDays === 0 ? "bugun 🎉" : `${r.inDays} kundan keyin`}
              {r.group ? ` · ${r.group}` : ""}
            </div>
            {r.phone && <div className="mt-1 font-mono text-xs text-primary">{r.phone}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
