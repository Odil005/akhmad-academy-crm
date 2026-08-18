import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Copy, Check, Heart, CreditCard, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BackgroundAnimation } from "@/components/BackgroundAnimation";
import { formatCardNumber, normalizeDonation, type DonationConfig } from "@/lib/donation";

export const Route = createFileRoute("/donate")({
  head: () => ({
    meta: [
      { title: "Homiylik va donat — Akhmad Academy" },
      {
        name: "description",
        content:
          "Akhmad Academy loyihasini qo'llab-quvvatlash uchun karta raqamlari va homiylik havolalari.",
      },
      { property: "og:title", content: "Homiylik va donat — Akhmad Academy" },
      {
        property: "og:description",
        content: "Loyihani qo'llab-quvvatlang: karta orqali yoki havola orqali donat qilish.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DonatePage;
});

function DonatePage() {
  const { data } = useQuery({
    queryKey: ["donation-settings"],
    queryFn: async (): Promise<DonationConfig> => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "donation")
        .maybeSingle();
      return normalizeDonation(data?.value);
    },
    staleTime: 5 * 60 * 1000,
  });

  const cfg = data ?? normalizeDonation(null);

  return (
    <main className="relative min-h-screen bg-transparent text-foreground">
      <BackgroundAnimation variant="hero" />

      <div className="bg-primary">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-4 md:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary-foreground/90 transition-colors hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" /> Bosh sahifa
          </Link>
          <span className="font-display text-sm tracking-[0.28em] text-primary-foreground">
            AKHMAD ACADEMY
          </span>
        </div>
      </div>

      <section className="mx-auto max-w-3xl px-4 py-14 md:px-8 md:py-20">
        <div className="mb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">
            <Heart className="h-3.5 w-3.5" /> Donat
          </span>
          <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
            {cfg.title}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {cfg.message}
          </p>
          {cfg.owner_name ? (
            <p className="mt-3 text-xs uppercase tracking-[0.25em] text-muted-foreground">
              {cfg.owner_name}
            </p>
          ) : null}
        </div>

        {cfg.cards.length === 0 && cfg.links.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
            Donat rekvizitlari hali kiritilmagan. Sozlamalar → Donat / Homiylik bo'limida karta
            raqami yoki havola qo'shing.
          </div>
        ) : null}

        {cfg.cards.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {cfg.cards.map((card, i) => (
              <CardBox
                key={`${card.number}-${i}`}
                label={card.label || "Karta"}
                number={card.number}
                holder={card.holder}
              />
            ))}
          </div>
        ) : null}

        {cfg.links.length > 0 ? (
          <div className="mt-8 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Onlayn havolalar
            </h2>
            {cfg.links.map((l, i) => (
              <a
                key={`${l.url}-${i}`}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-semibold transition-colors hover:border-primary/60"
              >
                <span>{l.label}</span>
                <ExternalLink className="h-4 w-4 text-primary" />
              </a>
            ))}
          </div>
        ) : null}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Qo'llab-quvvatlaganingiz uchun rahmat. Har bir hissa tizimni yaxshilashga sarflanadi.
        </p>
      </section>
    </main>
  );
}

function CardBox({
  label,
  number,
  holder,
}: {
  label: string;
  number: string;
  holder: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(number.replace(/\s/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        <CreditCard className="h-4 w-4 text-primary" /> {label}
      </div>
      <div className="mt-3 font-mono text-lg font-bold tracking-wider md:text-xl">
        {formatCardNumber(number)}
      </div>
      {holder ? <div className="mt-1 text-sm text-muted-foreground">{holder}</div> : null}
      <button
        onClick={copy}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Nusxa olindi" : "Nusxa olish"}
      </button>
    </div>
  );
}
