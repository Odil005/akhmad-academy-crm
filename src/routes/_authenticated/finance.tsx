import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DollarSign, TrendingUp, TrendingDown, Wallet, Plus, Trash2, Download, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finance")({
  component: FinancePage,
});

type Tab = "overview" | "transactions" | "expenses" | "accounts" | "report";

type CashAccount = { id: string; name: string; type: string; balance: number; is_active: boolean };
type Tx = {
  id: string; type: "income" | "expense"; source: string; category: string;
  amount: number; description: string | null; occurred_at: string;
  cash_account_id: string | null;
  cash_account: { name: string } | null;
};
type Expense = { id: string; category: string; amount: number; paid_at: string; description: string | null; cash_account_id: string | null; cash_account: { name: string } | null };

const fmt = (n: number) => `${Number(n || 0).toLocaleString()} so'm`;
const EXPENSE_CATEGORIES = ["Ijara", "Kommunal", "Maosh", "Marketing", "Ta'minot", "Soliq", "Boshqa"];

function FinancePage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [a, t, e] = await Promise.all([
      supabase.from("cash_accounts").select("id, name, type, balance, is_active, note").order("created_at"),
      supabase.from("transactions").select("*, cash_account:cash_accounts(name)").order("occurred_at", { ascending: false }).limit(500),
      supabase.from("expenses").select("*, cash_account:cash_accounts(name)").order("paid_at", { ascending: false }).limit(200),
    ]);
    setAccounts((a.data ?? []) as any);
    setTxs((t.data ?? []) as any);
    setExpenses((e.data ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTxs = txs.filter((t) => new Date(t.occurred_at) >= monthStart);
    const monthIncome = monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const monthExpense = monthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { totalBalance, monthIncome, monthExpense, profit: monthIncome - monthExpense };
  }, [accounts, txs]);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/15 p-2.5 text-primary"><DollarSign className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Moliya</h1>
          <p className="text-sm text-muted-foreground">Kassa, tranzaksiya, xarajat va hisobotlar</p>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-border">
        {([
          ["overview", "Umumiy"],
          ["transactions", "Tranzaksiyalar"],
          ["expenses", "Xarajatlar"],
          ["accounts", "Kassalar"],
          ["report", "Hisobot"],
        ] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>{label}</button>
        ))}
      </nav>

      {loading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : tab === "overview" ? (
        <Overview totals={totals} accounts={accounts} txs={txs.slice(0, 15)} />
      ) : tab === "transactions" ? (
        <Transactions txs={txs} accounts={accounts} onChange={load} />
      ) : tab === "expenses" ? (
        <Expenses expenses={expenses} accounts={accounts} onChange={load} />
      ) : tab === "accounts" ? (
        <Accounts accounts={accounts} onChange={load} />
      ) : (
        <Report txs={txs} />
      )}
    </div>
  );
}

function Overview({ totals, accounts, txs }: { totals: any; accounts: CashAccount[]; txs: Tx[] }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Umumiy balans" value={fmt(totals.totalBalance)} icon={<Wallet className="h-5 w-5" />} tone="primary" />
        <StatCard label="Oylik kirim" value={fmt(totals.monthIncome)} icon={<TrendingUp className="h-5 w-5" />} tone="green" />
        <StatCard label="Oylik chiqim" value={fmt(totals.monthExpense)} icon={<TrendingDown className="h-5 w-5" />} tone="red" />
        <StatCard label="Sof foyda" value={fmt(totals.profit)} icon={<DollarSign className="h-5 w-5" />} tone={totals.profit >= 0 ? "green" : "red"} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Kassalar</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {accounts.map((a) => (
            <div key={a.id} className="card-premium p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{a.type}</div>
              <div className="mt-1 font-bold">{a.name}</div>
              <div className="mt-2 text-xl font-extrabold">{fmt(a.balance)}</div>
            </div>
          ))}
          {accounts.length === 0 && <p className="text-sm text-muted-foreground">Kassalar yo'q — Kassalar tabidan qo'shing.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Oxirgi tranzaksiyalar</h2>
        <TxTable txs={txs} />
      </section>
    </div>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "primary" | "green" | "red" }) {
  const toneCls = tone === "green" ? "bg-green-500/15 text-green-600" : tone === "red" ? "bg-red-500/15 text-red-600" : "bg-primary/15 text-primary";
  return (
    <div className="card-premium p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`rounded-lg p-2 ${toneCls}`}>{icon}</div>
      </div>
      <div className="mt-3 text-2xl font-extrabold">{value}</div>
    </div>
  );
}

function TxTable({ txs }: { txs: Tx[] }) {
  if (!txs.length) return <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Yozuv yo'q</p>;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Sana</th>
              <th className="px-4 py-3">Turi</th>
              <th className="px-4 py-3">Kategoriya</th>
              <th className="px-4 py-3">Kassa</th>
              <th className="px-4 py-3">Izoh</th>
              <th className="px-4 py-3 text-right">Summa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {txs.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2.5 text-muted-foreground">{new Date(t.occurred_at).toLocaleDateString()}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.type === "income" ? "bg-green-500/15 text-green-600" : "bg-red-500/15 text-red-600"}`}>
                    {t.type === "income" ? "Kirim" : "Chiqim"}
                  </span>
                </td>
                <td className="px-4 py-2.5">{t.category}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{t.cash_account?.name ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{t.description ?? "—"}</td>
                <td className={`px-4 py-2.5 text-right font-semibold ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                  {t.type === "income" ? "+" : "−"}{fmt(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Transactions({ txs, accounts, onChange }: { txs: Tx[]; accounts: CashAccount[]; onChange: () => void }) {
  const [type, setType] = useState<"all" | "income" | "expense">("all");
  const [accId, setAccId] = useState<string>("all");
  const [openManual, setOpenManual] = useState(false);

  const filtered = txs.filter((t) => (type === "all" || t.type === type) && (accId === "all" || t.cash_account_id === accId));

  const exportCSV = () => {
    const rows = [["Sana", "Turi", "Kategoriya", "Kassa", "Izoh", "Summa"]];
    filtered.forEach((t) => rows.push([
      new Date(t.occurred_at).toLocaleString(), t.type, t.category, t.cash_account?.name ?? "", t.description ?? "", String(t.amount),
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={type} onChange={(e) => setType(e.target.value as any)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <option value="all">Barcha turi</option><option value="income">Kirim</option><option value="expense">Chiqim</option>
        </select>
        <select value={accId} onChange={(e) => setAccId(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <option value="all">Barcha kassa</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button onClick={exportCSV} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-primary/5">
            <Download className="h-4 w-4" /> CSV
          </button>
          <button onClick={() => setOpenManual(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
            <Plus className="h-4 w-4" /> Qo'lda
          </button>
        </div>
      </div>
      <TxTable txs={filtered} />
      {openManual && <ManualTxModal accounts={accounts} onClose={() => setOpenManual(false)} onDone={() => { setOpenManual(false); onChange(); }} />}
    </div>
  );
}

function ManualTxModal({ accounts, onClose, onDone }: { accounts: CashAccount[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ type: "income" as "income" | "expense", category: "", amount: "", cash_account_id: accounts[0]?.id ?? "", description: "" });
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.category) return toast.error("Kategoriya va summa kerak");
    setSaving(true);
    const { error } = await supabase.from("transactions").insert({
      type: form.type, source: "manual", category: form.category,
      amount: Number(form.amount), cash_account_id: form.cash_account_id || null,
      description: form.description || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Qo'shildi"); onDone();
  };
  return (
    <Modal title="Qo'lda tranzaksiya" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Turi" value={form.type} onChange={(v) => setForm({ ...form, type: v as any })} options={[["income", "Kirim"], ["expense", "Chiqim"]]} />
          <Field label="Kategoriya" value={form.category} onChange={(v) => setForm({ ...form, category: v })} required />
        </div>
        <Field label="Summa" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} type="number" required />
        <Select label="Kassa" value={form.cash_account_id} onChange={(v) => setForm({ ...form, cash_account_id: v })} options={accounts.map((a) => [a.id, a.name])} />
        <Field label="Izoh" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <button disabled={saving} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? "..." : "Saqlash"}</button>
      </form>
    </Modal>
  );
}

function Expenses({ expenses, accounts, onChange }: { expenses: Expense[]; accounts: CashAccount[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const remove = async (id: string) => {
    if (!confirm("O'chirilsinmi?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("O'chirildi"); onChange();
  };
  const byCat = useMemo(() => {
    const m: Record<string, number> = {};
    expenses.forEach((e) => { m[e.category] = (m[e.category] ?? 0) + Number(e.amount); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{expenses.length} yozuv</div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Xarajat qo'shish
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {byCat.slice(0, 4).map(([cat, sum]) => (
          <div key={cat} className="card-premium p-4">
            <div className="text-xs uppercase text-muted-foreground">{cat}</div>
            <div className="mt-2 text-lg font-extrabold text-red-600">{fmt(sum)}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs font-semibold uppercase text-muted-foreground">
              <tr><th className="px-4 py-3">Sana</th><th className="px-4 py-3">Kategoriya</th><th className="px-4 py-3">Kassa</th><th className="px-4 py-3">Izoh</th><th className="px-4 py-3 text-right">Summa</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5 text-muted-foreground">{new Date(e.paid_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 font-semibold">{e.category}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.cash_account?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.description ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-red-600">{fmt(e.amount)}</td>
                  <td className="px-4 py-2.5 text-right"><button onClick={() => remove(e.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Yozuv yo'q</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {open && <NewExpenseModal accounts={accounts} onClose={() => setOpen(false)} onDone={() => { setOpen(false); onChange(); }} />}
    </div>
  );
}

function NewExpenseModal({ accounts, onClose, onDone }: { accounts: CashAccount[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    category: EXPENSE_CATEGORIES[0], amount: "", paid_at: new Date().toISOString().slice(0, 10),
    description: "", cash_account_id: accounts[0]?.id ?? "",
  });
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("expenses").insert({
      category: form.category, amount: Number(form.amount), paid_at: form.paid_at,
      description: form.description || null, cash_account_id: form.cash_account_id || null,
      created_by: user.user?.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Xarajat qo'shildi"); onDone();
  };
  return (
    <Modal title="Yangi xarajat" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Select label="Kategoriya" value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={EXPENSE_CATEGORIES.map((c) => [c, c])} />
        <Field label="Summa" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} type="number" required />
        <Field label="Sana" value={form.paid_at} onChange={(v) => setForm({ ...form, paid_at: v })} type="date" />
        <Select label="Kassa" value={form.cash_account_id} onChange={(v) => setForm({ ...form, cash_account_id: v })} options={accounts.map((a) => [a.id, a.name])} />
        <Field label="Izoh" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <button disabled={saving} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? "..." : "Saqlash"}</button>
      </form>
    </Modal>
  );
}

function Accounts({ accounts, onChange }: { accounts: CashAccount[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("cash");
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("cash_accounts").insert({ name: name.trim(), type: type as "cash" | "card" | "bank" | "online" | "other" });
    if (error) return toast.error(error.message);
    setName(""); toast.success("Qo'shildi"); onChange();
  };
  const toggle = async (a: CashAccount) => {
    await supabase.from("cash_accounts").update({ is_active: !a.is_active }).eq("id", a.id);
    onChange();
  };
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kassa nomi" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <option value="cash">Naqd</option><option value="card">Karta</option><option value="bank">Bank</option><option value="online">Online</option><option value="other">Boshqa</option>
        </select>
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Qo'shish</button>
      </form>

      <div className="grid gap-3 md:grid-cols-2">
        {accounts.map((a) => (
          <div key={a.id} className="card-premium flex items-center justify-between p-4">
            <div>
              <div className="text-xs uppercase text-muted-foreground">{a.type}</div>
              <div className="font-bold">{a.name}</div>
              <div className="mt-1 text-lg font-extrabold">{fmt(a.balance)}</div>
            </div>
            <button onClick={() => toggle(a)} className={`rounded-full px-3 py-1 text-xs font-semibold ${a.is_active ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}>
              {a.is_active ? "Faol" : "Nofaol"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Report({ txs }: { txs: Tx[] }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const months = useMemo(() => {
    const arr = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
    txs.forEach((t) => {
      const d = new Date(t.occurred_at);
      if (d.getFullYear() !== year) return;
      const m = d.getMonth();
      if (t.type === "income") arr[m].income += Number(t.amount); else arr[m].expense += Number(t.amount);
    });
    return arr;
  }, [txs, year]);
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);
  const monthNames = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];
  const max = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <div className="text-sm text-muted-foreground">Yillik hisobot</div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Yillik kirim" value={fmt(totalIncome)} icon={<TrendingUp className="h-5 w-5" />} tone="green" />
        <StatCard label="Yillik chiqim" value={fmt(totalExpense)} icon={<TrendingDown className="h-5 w-5" />} tone="red" />
        <StatCard label="Sof foyda" value={fmt(totalIncome - totalExpense)} icon={<DollarSign className="h-5 w-5" />} tone={totalIncome - totalExpense >= 0 ? "green" : "red"} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 text-sm font-semibold">Oylik dinamika</div>
        <div className="grid grid-cols-12 gap-2">
          {months.map((m, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="flex h-32 w-full items-end gap-0.5">
                <div className="flex-1 rounded-t bg-green-500/70" style={{ height: `${(m.income / max) * 100}%` }} title={`Kirim: ${fmt(m.income)}`} />
                <div className="flex-1 rounded-t bg-red-500/70" style={{ height: `${(m.expense / max) * 100}%` }} title={`Chiqim: ${fmt(m.expense)}`} />
              </div>
              <div className="text-[10px] font-semibold text-muted-foreground">{monthNames[i]}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-green-500/70" /> Kirim</span>
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-red-500/70" /> Chiqim</span>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required, type = "text" }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string }) {
  return (
    <label className="block text-sm">
      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block text-sm">
      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
