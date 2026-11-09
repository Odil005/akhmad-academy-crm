import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Share, Smartphone, SquarePlus, Users } from "lucide-react";
import crmApk from "@/assets/apps/akhmad-crm.apk.asset.json";
import parentApk from "@/assets/apps/akhmad-ota-ona.apk.asset.json";

export const Route = createFileRoute("/ilova")({
  head: () => ({
    meta: [
      { title: "Mobil ilovalar | Akhmad Academy" },
      { name: "description", content: "Akhmad Academy xodimlar va ota-onalar uchun Android va iPhone ilovalari." },
      { property: "og:title", content: "Mobil ilovalar | Akhmad Academy" },
      { property: "og:description", content: "Xodimlar va ota-onalar uchun alohida ilovalarni yuklab oling." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppsPage,
});

const APPS = [
  {
    key: "parent",
    title: "Ota-ona ilovasi",
    text: "Farzandingiz davomati, to'lovlari va baholari. Telefon raqam va Telegram kod bilan kirasiz.",
    apk: parentApk.url,
    file: "akhmad-ota-ona.apk",
    web: "/ota-ona" as const,
    icon: Users,
  },
  {
    key: "staff",
    title: "Xodimlar ilovasi (CRM)",
    text: "Direktor, administrator va o'qituvchilar uchun: o'quvchilar, to'lov, davomat va guruhlar.",
    apk: crmApk.url,
    file: "akhmad-crm.apk",
    web: "/dashboard" as const,
    icon: Smartphone,
  },
];

function AppsPage() {
  return (
    <div className="crm-theme min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
        <header className="flex items-center gap-3">
          <img src="/logo-192.png" alt="Akhmad Academy" width={44} height={44} className="h-11 w-11 rounded-full" />
          <div>
            <h1 className="text-2xl font-extrabold">Mobil ilovalar</h1>
            <p className="text-sm text-muted-foreground">Akhmad Academy · Android va iPhone</p>
          </div>
        </header>

        {APPS.map((a) => (
          <section key={a.key} className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <a.icon className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <h2 className="text-lg font-bold">{a.title}</h2>
                <p className="text-sm text-muted-foreground">{a.text}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-muted/50 p-4">
                <div className="mb-2 text-sm font-bold">Android</div>
                <a href={a.apk} download={a.file}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
                  <Download className="h-4 w-4" /> APK yuklab olish
                </a>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Fayl ochilganda telefon "noma'lum manbalar"ga ruxsat so'rasa, shu safar ruxsat bering.
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 p-4">
                <div className="mb-2 text-sm font-bold">iPhone</div>
                <ol className="space-y-1.5 text-xs text-muted-foreground">
                  <li>1. <Link to={a.web} className="font-semibold text-primary underline">Shu sahifani</Link> Safari'da oching.</li>
                  <li className="flex items-center gap-1">2. Pastdagi <Share className="inline h-3.5 w-3.5" /> "Ulashish" tugmasini bosing.</li>
                  <li className="flex items-center gap-1">3. <SquarePlus className="inline h-3.5 w-3.5" /> "Ekranga qo'shish" ni tanlang.</li>
                </ol>
              </div>
            </div>
          </section>
        ))}
        <p className="text-center text-xs text-muted-foreground">Play Market'dagi ilovalar tez orada.</p>
      </div>
    </div>
  );
}
