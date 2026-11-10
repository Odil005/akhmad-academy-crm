import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { decideApplication, listApplications } from "@/lib/mini-app.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/arizalar")({
  head: () => ({
    meta: [
      { title: "Yangi arizalar | Akhmad Academy" },
      { name: "description", content: "Telegram ilova orqali kelgan o'quvchi va ota-ona arizalarini tasdiqlash." },
      { property: "og:title", content: "Yangi arizalar | Akhmad Academy" },
      { property: "og:description", content: "Telegram arizalarini tasdiqlash yoki rad etish." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApplicationsPage,
});

const STATUS: Record<string, string> = { pending: "Kutilmoqda", approved: "Tasdiqlangan", rejected: "Rad etilgan" };

function ApplicationsPage() {
  const list = useServerFn(listApplications);
  const decide = useServerFn(decideApplication);
  const qc = useQueryClient();
  const apps = useQuery({ queryKey: ["applications"], queryFn: () => list() });
  const groups = useQuery({
    queryKey: ["applications-groups"],
    queryFn: async () => {
      const { data } = await supabase.from("groups").select("id, name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const [pick, setPick] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, approve: boolean) {
    setBusy(id);
    try {
      await decide({ data: { id, approve, groupId: pick[id] || null, reason: reason[id] || null } });
      toast.success(approve ? "Tasdiqlandi, Telegramga xabar yuborildi" : "Rad etildi");
      await qc.invalidateQueries({ queryKey: ["applications"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xato");
    } finally {
      setBusy(null);
    }
  }

  const rows = apps.data ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const done = rows.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Yangi arizalar</h1>
        <p className="text-sm text-muted-foreground">Telegram ilova orqali ro'yxatdan o'tganlar. Tasdiqlamaguningizcha ular guruhga qo'shilmaydi.</p>
      </div>
      {apps.isLoading && <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>}
      {apps.error && <p className="text-sm text-destructive">{(apps.error as Error).message}</p>}
      {!apps.isLoading && pending.length === 0 && <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">Kutilayotgan ariza yo'q.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {pending.map((a) => (
          <div key={a.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{a.first_name} {a.last_name}</p>
                <p className="text-xs text-muted-foreground">
                  {a.role === "student" ? "O'quvchi" : "Ota-ona"} · {a.phone} {a.telegram_username ? `· @${a.telegram_username}` : ""}
                </p>
                {a.subject && <p className="text-xs text-muted-foreground">Fan: {a.subject}</p>}
                <p className="text-xs text-muted-foreground">Login: {a.username}</p>
              </div>
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">Kutilmoqda</span>
            </div>
            {a.role === "student" && (
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={pick[a.id] ?? ""}
                onChange={(e) => setPick((p) => ({ ...p, [a.id]: e.target.value }))}
                aria-label="Guruh"
              >
                <option value="">Guruhni tanlang…</option>
                {(groups.data ?? []).map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
            <Input placeholder="Rad etish sababi (ixtiyoriy)" value={reason[a.id] ?? ""} onChange={(e) => setReason((r) => ({ ...r, [a.id]: e.target.value }))} />
            <div className="flex gap-2">
              <Button className="flex-1" disabled={busy === a.id || (a.role === "student" && !pick[a.id])} onClick={() => act(a.id, true)}>Tasdiqlash</Button>
              <Button variant="outline" className="flex-1" disabled={busy === a.id} onClick={() => act(a.id, false)}>Rad etish</Button>
            </div>
          </div>
        ))}
      </div>
      {done.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Ko'rib chiqilganlar</h2>
          <div className="divide-y divide-border rounded-xl border border-border">
            {done.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 text-sm">
                <span>{a.first_name} {a.last_name} · {a.role === "student" ? "O'quvchi" : "Ota-ona"}</span>
                <span className="text-muted-foreground">{STATUS[a.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Telegram ilova: <Link to="/tg" className="underline">/tg</Link></p>
    </div>
  );
}
