import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Heart, Plus, Trash2 } from "lucide-react";
import {
  EMPTY_DONATION,
  normalizeDonation,
  type DonationCard,
  type DonationConfig,
  type DonationLink,
} from "@/lib/donation";

export const Route = createFileRoute("/_authenticated/settings/donation")({
  component: DonationSettings,
});

function DonationSettings() {
  const [cfg, setCfg] = useState<DonationConfig>(EMPTY_DONATION);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "donation")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setCfg(normalizeDonation(data.value));
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const clean: DonationConfig = {
      ...cfg,
      cards: cfg.cards.filter((c) => c.number.trim()),
      links: cfg.links.filter((l) => l.url.trim()),
    };
    const { error } = await supabase
      .from("settings")
      .update({ value: clean as never })
      .eq("key", "donation");
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      setCfg(clean);
      toast.success("Saqlandi");
    }
  };

  const setCard = (i: number, patch: Partial<DonationCard>) =>
    setCfg((p) => ({ ...p, cards: p.cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));
  const setLink = (i: number, patch: Partial<DonationLink>) =>
    setCfg((p) => ({ ...p, links: p.links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));

  const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Donat / Homiylik</h2>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Bu ma'lumotlar saytdagi <span className="font-semibold">/donate</span> sahifasida
          ko'rsatiladi.
        </p>

        <label className="mb-4 flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
            className="h-4 w-4"
          />
          Saytda ko'rsatish
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sarlavha
            </div>
            <input
              value={cfg.title}
              onChange={(e) => setCfg({ ...cfg, title: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="block text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Karta egasi / ism
            </div>
            <input
              value={cfg.owner_name}
              onChange={(e) => setCfg({ ...cfg, owner_name: e.target.value })}
              placeholder="Bekpolatov S."
              className={inputCls}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Matn
            </div>
            <textarea
              value={cfg.message}
              onChange={(e) => setCfg({ ...cfg, message: e.target.value })}
              rows={3}
              className={inputCls}
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider">Karta raqamlari</h3>
          <button
            onClick={() =>
              setCfg({ ...cfg, cards: [...cfg.cards, { label: "Uzcard", number: "", holder: "" }] })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary/60"
          >
            <Plus className="h-3.5 w-3.5" /> Karta qo'shish
          </button>
        </div>
        {cfg.cards.length === 0 ? (
          <p className="text-xs text-muted-foreground">Hali karta qo'shilmagan.</p>
        ) : null}
        <div className="space-y-3">
          {cfg.cards.map((c, i) => (
            <div key={i} className="grid gap-3 md:grid-cols-[140px_1fr_1fr_auto]">
              <input
                value={c.label}
                onChange={(e) => setCard(i, { label: e.target.value })}
                placeholder="Uzcard / Humo / Visa"
                className={inputCls}
              />
              <input
                value={c.number}
                onChange={(e) => setCard(i, { number: e.target.value })}
                placeholder="8600 1234 5678 9012"
                inputMode="numeric"
                className={inputCls}
              />
              <input
                value={c.holder}
                onChange={(e) => setCard(i, { holder: e.target.value })}
                placeholder="Karta egasi"
                className={inputCls}
              />
              <button
                onClick={() => setCfg({ ...cfg, cards: cfg.cards.filter((_, x) => x !== i) })}
                className="inline-flex items-center justify-center rounded-lg border border-destructive/40 px-3 text-destructive"
                aria-label="O'chirish"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider">Onlayn havolalar</h3>
          <button
            onClick={() => setCfg({ ...cfg, links: [...cfg.links, { label: "", url: "" }] })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary/60"
          >
            <Plus className="h-3.5 w-3.5" /> Havola qo'shish
          </button>
        </div>
        {cfg.links.length === 0 ? (
          <p className="text-xs text-muted-foreground">Payme, Click, PayPal va boshqa havolalar.</p>
        ) : null}
        <div className="space-y-3">
          {cfg.links.map((l, i) => (
            <div key={i} className="grid gap-3 md:grid-cols-[200px_1fr_auto]">
              <input
                value={l.label}
                onChange={(e) => setLink(i, { label: e.target.value })}
                placeholder="Payme orqali"
                className={inputCls}
              />
              <input
                value={l.url}
                onChange={(e) => setLink(i, { url: e.target.value })}
                placeholder="https://payme.uz/..."
                className={inputCls}
              />
              <button
                onClick={() => setCfg({ ...cfg, links: cfg.links.filter((_, x) => x !== i) })}
                className="inline-flex items-center justify-center rounded-lg border border-destructive/40 px-3 text-destructive"
                aria-label="O'chirish"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saving ? "..." : "Saqlash"}
      </button>
    </div>
  );
}
