import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  ShieldCheck,
  ChefHat,
  Sparkles,
  Plus,
  Loader2,
  Wallet,
  CheckCircle2,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/salary")({
  head: () => ({
    meta: [
      { title: "Oylik katalogi | Akhmad CRM" },
      { name: "description", content: "Akhmad CRM — xodimlar oylik katalogi." },
      { property: "og:title", content: "Oylik katalogi | Akhmad CRM" },
      { property: "og:description", content: "Akhmad CRM — xodimlar oylik katalogi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SalaryCatalogPage,
});

const POSITIONS = [
  { key: "teacher", label: "O'qituvchi oyligi", icon: GraduationCap },
  { key: "admin", label: "Admin oyligi", icon: ShieldCheck },
  { key: "cook", label: "Oshpaz oyligi", icon: ChefHat },
  { key: "cleaner", label: "Farrosh oyligi", icon: Sparkles },
] as const;

type Position = (typeof POSITIONS)[number]["key"];

type Row = {
  id: string;
  staff_name: string;
  position: string;
  monthly_salary: number;
  period_month: string;
  paid_amount: number;
  status: string;
  note: string | null;
};

const fmt = (n: number) => Number(n || 0).toLocaleString("uz-UZ");

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function SalaryCatalogPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(currentMonth());
  const [adding, setAdding] = useState<Position | null>(null);
  const [name, setName] = useState("");
  const [salary, setSalary] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("staff_salaries")
      .select("id, staff_name, position, monthly_salary, period_month, paid_amount, status, note")
      .eq("period_month", `${period}-01`)
      .order("staff_name");
    setRows((data as never) ?? []);
    setLoading(false);
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const byPosition = useMemo(() => {
    const map = new Map<string, Row[]>();
    POSITIONS.forEach((p) => map.set(p.key, []));
    rows.forEach((r) => {
      const list = map.get(r.position) ?? [];
      list.push(r);
      map.set(r.position, list);
    });
    return map;
  }, [rows]);

  const addStaff = async () => {
    if (!adding || !name.trim() || salary <= 0) return;
    setBusy(true);
    await supabase.from("staff_salaries").insert({
      staff_name: name.trim(),
      position: adding,
      monthly_salary: salary,
      period_month: `${period}-01`,
    });
    setBusy(false);
    setAdding(null);
    setName("");
    setSalary(0);
    void load();
  };

  const markPaid = async (r: Row) => {
    setBusy(true);
    await supabase
      .from("staff_salaries")
      .update({ paid_amount: r.monthly_salary, status: "paid" })
      .eq("id", r.id);
    setBusy(false);
    void load();
  };

  const remove = async (id: string) => {
    setBusy(true);
    await supabase.from("staff_salaries").delete().eq("id", id);
    setBusy(false);
    void load();
  };

  const totalPlanned = rows.reduce((s, r) => s + Number(r.monthly_salary), 0);
  const totalPaid = rows.reduce((s, r) => s + Number(r.paid_amount), 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Oylik katalogi</h1>
          <p className="text-sm text-muted-foreground">
            Xodimlar oyligi — o'qituvchi, admin, oshpaz, farrosh
          </p>
        </div>
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <Wallet className="h-5 w-5 text-primary" />
          <div className="mt-2 text-xl font-extrabold">{fmt(totalPlanned)} so'm</div>
          <div className="text-xs text-muted-foreground">Rejalashtirilgan oyliklar</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div className="mt-2 text-xl font-extrabold">{fmt(totalPaid)} so'm</div>
          <div className="text-xs text-muted-foreground">To'langan</div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {POSITIONS.map((p) => {
            const list = byPosition.get(p.key) ?? [];
            const subtotal = list.reduce((s, r) => s + Number(r.monthly_salary), 0);
            return (
              <section key={p.key} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-bold">
                    <p.icon className="h-4 w-4 text-primary" /> {p.label}
                  </h2>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {fmt(subtotal)} so'm
                  </span>
                </div>

                <div className="mt-3 divide-y divide-border">
                  {list.length === 0 && (
                    <p className="py-3 text-xs text-muted-foreground">Hali xodim qo'shilmagan</p>
                  )}
                  {list.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{r.staff_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmt(Number(r.monthly_salary))} so'm / oy
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {r.status === "paid" ? (
                          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success">
                            To'langan
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => void markPaid(r)}
                            className="h-7 text-[11px]"
                          >
                            To'lash
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={busy}
                          onClick={() => void remove(r.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title="O'chirish"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {adding === p.key ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
                    <input
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Xodim ismi"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min={0}
                      value={salary || ""}
                      onChange={(e) => setSalary(Number(e.target.value))}
                      placeholder="Oylik maoshi (so'm)"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setAdding(null)}>
                        Bekor qilish
                      </Button>
                      <Button size="sm" disabled={busy || !name.trim() || salary <= 0} onClick={() => void addStaff()}>
                        Saqlash
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAdding(p.key);
                      setName("");
                      setSalary(0);
                    }}
                    className="mt-3 w-full"
                  >
                    <Plus className="h-3.5 w-3.5" /> Xodim qo'shish
                  </Button>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
