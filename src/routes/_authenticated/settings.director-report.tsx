import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Send, MessageCircle, Loader2 } from "lucide-react";
import { sendDirectorReportTest } from "@/lib/director-report.functions";

export const Route = createFileRoute("/_authenticated/settings/director-report")({
  component: DirectorReportSettings,
});


type Recipient = {
  id: string;
  full_name: string;
  telegram_chat_id: string;
  is_active: boolean;
};

function DirectorReportSettings() {
  const [list, setList] = useState<Recipient[]>([]);
  const [name, setName] = useState("");
  const [chatId, setChatId] = useState("");
  const [testing, setTesting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);


  const load = async () => {
    const { data } = await supabase.from("director_report_recipients").select("*").order("created_at");
    setList((data ?? []) as Recipient[]);
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!name || !chatId) return;
    const { error } = await supabase.from("director_report_recipients").insert({
      full_name: name,
      telegram_chat_id: chatId,
      is_active: true,
    });
    if (!error) {
      setName("");
      setChatId("");
      load();
    } else {
      setMsg(error.message);
    }
  };

  const toggle = async (r: Recipient) => {
    await supabase.from("director_report_recipients").update({ is_active: !r.is_active }).eq("id", r.id);
    load();
  };

  const remove = async (r: Recipient) => {
    await supabase.from("director_report_recipients").delete().eq("id", r.id);
    load();
  };

  const testOne = async (r: Recipient) => {
    setTestingId(r.id);
    setMsg(null);
    try {
      const res = await sendDirectorReportTest({ data: { recipientId: r.id } });
      setMsg(res.ok ? `✅ ${r.full_name}: sinov xabari yuborildi` : `⚠️ ${r.full_name}: ${res.error}`);
    } catch (e) {
      setMsg((e as Error).message || "Yuborilmadi");
    } finally {
      setTestingId(null);
    }
  };


  const runNow = async () => {
    setTesting(true);
    setMsg(null);
    try {
      const r = await fetch("/api/public/cron/daily-report", { method: "POST" });
      const j = await r.json();
      setMsg(j.ok ? `✅ Yuborildi: ${j.sends?.length ?? 0} ta qabul qiluvchiga` : "Xato");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">Direktor kunlik hisoboti</h1>
        <p className="text-sm text-muted-foreground">
          Har kuni kechki 20:00 (Toshkent) da Telegram orqali kunlik xulosa yuboriladi (daromad, xarajat, qarzdorlar, davomat, Jarvis xulosasi).
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 font-bold">Qabul qiluvchilar</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            placeholder="F.I.Sh"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            placeholder="Telegram chat ID (masalan 123456789)"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={add}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Qo'shish
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Chat ID'ni bilish uchun @userinfobot ga xabar yuboring yoki @Akhmad_Academy_bot orqali ota-ona botiga xuddi shu chat ID keladi.
        </p>

        <div className="mt-6 divide-y divide-border">
          {list.length === 0 && <p className="py-4 text-sm text-muted-foreground">Hozircha qabul qiluvchi qo'shilmagan</p>}
          {list.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-semibold">{r.full_name}</div>
                <div className="text-xs text-muted-foreground">chat_id: {r.telegram_chat_id}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={r.is_active} onChange={() => toggle(r)} />
                  Faol
                </label>
                <button
                  onClick={() => remove(r)}
                  className="rounded-lg border border-destructive/40 p-2 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <button
          onClick={runNow}
          disabled={testing}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> {testing ? "Yuborilmoqda..." : "Hozir yuborish (test)"}
        </button>
        {msg && <p className="mt-3 text-sm">{msg}</p>}
      </div>
    </div>
  );
}
