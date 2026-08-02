import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createTelegramLink } from "@/lib/telegram-admin.functions";
import { Send, Copy, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

type Kind = "student" | "teacher" | "admin" | "director";

type Person = { id: string; name: string; sub: string | null; linked: boolean };

const TABS: { kind: Kind; label: string }[] = [
  { kind: "student", label: "O'quvchi" },
  { kind: "teacher", label: "O'qituvchi" },
  { kind: "admin", label: "Admin" },
  { kind: "director", label: "Direktor" },
];

/** Dashboard panel: generate a one-time Telegram link for anyone in the CRM. */
export function TelegramLinkPanel() {
  const makeLink = useServerFn(createTelegramLink);
  const [kind, setKind] = useState<Kind>("student");
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<{ name: string; url: string | null; token: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setLink(null);
      if (kind === "student") {
        const { data } = await supabase
          .from("students")
          .select("id, full_name, first_name, last_name, parent_phone, parent_telegram_chat_id")
          .order("created_at", { ascending: false })
          .limit(400);
        if (!alive) return;
        setPeople(
          (data ?? []).map((s: any) => ({
            id: s.id,
            name: (s.full_name || `${s.last_name ?? ""} ${s.first_name ?? ""}`).trim() || "—",
            sub: s.parent_phone ?? null,
            linked: Boolean(s.parent_telegram_chat_id),
          })),
        );
      } else {
        const { data: roleRows } = await supabase.from("user_roles").select("user_id").eq("role", kind);
        const ids = (roleRows ?? []).map((r: any) => r.user_id).filter(Boolean);
        if (!ids.length) { if (alive) { setPeople([]); setLoading(false); } return; }
        const [{ data: profs }, { data: links }] = await Promise.all([
          supabase.from("profiles").select("id, full_name, phone").in("id", ids),
          supabase.from("staff_telegram_links").select("user_id").in("user_id", ids),
        ]);
        if (!alive) return;
        const linkedSet = new Set((links ?? []).map((l: any) => l.user_id));
        setPeople(
          (profs ?? []).map((p: any) => ({
            id: p.id,
            name: p.full_name || "—",
            sub: p.phone ?? null,
            linked: linkedSet.has(p.id),
          })).sort((a, b) => a.name.localeCompare(b.name)),
        );
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [kind]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q ? people.filter((p) => p.name.toLowerCase().includes(q) || (p.sub ?? "").includes(q)) : people;
    return rows.slice(0, 12);
  }, [people, query]);

  const generate = async (p: Person) => {
    setBusy(p.id);
    try {
      const res = await makeLink({
        data: {
          kind,
          studentId: kind === "student" ? p.id : null,
          targetUserId: kind === "student" ? null : p.id,
          label: p.name,
        },
      });
      if (!res.ok) { toast.error(res.error); return; }
      setLink({ name: p.name, url: res.link, token: res.token });
      if (res.link) {
        await navigator.clipboard.writeText(res.link).catch(() => {});
        toast.success("Havola yaratildi va nusxalandi");
      } else {
        toast.success("Token yaratildi (bot username topilmadi)");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Xatolik");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Send className="h-4 w-4 text-primary" /> Tezkor Telegram ID yaratish
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.kind}
              onClick={() => setKind(t.kind)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${kind === t.kind ? "bg-primary text-primary-foreground" : "border border-border hover:border-primary"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ism yoki telefon bo'yicha qidirish..."
        className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
      />

      {link && (
        <div className="mt-3 rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm">
          <div className="font-semibold">{link.name}</div>
          <div className="mt-1 break-all font-mono text-xs text-muted-foreground">{link.url ?? link.token}</div>
          <button
            onClick={() => { navigator.clipboard.writeText(link.url ?? link.token); toast.success("Nusxalandi"); }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
          >
            <Copy className="h-3.5 w-3.5" /> Havolani nusxalash
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            Havolani yuboring — foydalanuvchi bosgach Telegram ID avtomatik saqlanadi.
          </p>
        </div>
      )}

      <div className="mt-3 divide-y divide-border text-sm">
        {loading && <div className="h-16 animate-pulse rounded-xl bg-secondary/60" />}
        {!loading && filtered.length === 0 && <p className="py-3 text-muted-foreground">Ro'yxat bo'sh</p>}
        {filtered.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <div className="truncate font-semibold">{p.name}</div>
              <div className="truncate text-xs text-muted-foreground">{p.sub ?? "telefon yo'q"}</div>
            </div>
            {p.linked && (
              <span className="hidden shrink-0 items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-bold text-green-600 sm:flex">
                <Check className="h-3 w-3" /> ulangan
              </span>
            )}
            <button
              onClick={() => generate(p)}
              disabled={busy === p.id}
              className="shrink-0 rounded-lg border border-primary/50 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-60"
            >
              {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Telegram ID"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
