import { createFileRoute } from "@tanstack/react-router";

/**
 * Server sozlamalari diagnostikasi: qaysi runtime kalitlar mavjudligini
 * ko'rsatadi. Faqat true/false qaytariladi — hech bir kalit qiymati, uzunligi
 * yoki fragmenti oshkor qilinmaydi.
 */
export const Route = createFileRoute("/api/public/health/config")({
  server: {
    handlers: {
      GET: async () => {
        const present = (name: string) => Boolean(process.env[name]);

        const required = {
          SUPABASE_URL: present("SUPABASE_URL"),
          SUPABASE_PUBLISHABLE_KEY: present("SUPABASE_PUBLISHABLE_KEY"),
          SUPABASE_SERVICE_ROLE_KEY: present("SUPABASE_SERVICE_ROLE_KEY"),
        };
        const optional = {
          APP_BASE_URL: present("APP_BASE_URL"),
          CRON_SECRET: present("CRON_SECRET"),
          TELEGRAM_BOT_TOKEN: present("TELEGRAM_BOT_TOKEN"),
          TELEGRAM_WEBHOOK_SECRET: present("TELEGRAM_WEBHOOK_SECRET"),
        };

        const missing = Object.entries(required)
          .filter(([, ok]) => !ok)
          .map(([name]) => name);

        return new Response(
          JSON.stringify({
            status: missing.length ? "misconfigured" : "ok",
            can_create_users: missing.length === 0,
            missing,
            required,
            optional,
          }),
          {
            status: missing.length ? 503 : 200,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          },
        );
      },
    },
  },
});
