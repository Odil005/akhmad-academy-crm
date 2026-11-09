# Deploy: local server, Cloudflare, Render, Vercel

Bitta kod bazasi, to'rt xil server. Server turi build vaqtidagi `NITRO_PRESET`
bilan tanlanadi (`vite.config.ts`).

## 0. Majburiy environment variables

Build vaqtida (client bundle uchun) kerak:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Runtime (server) uchun kerak:

```
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
APP_BASE_URL=https://<sizning-domeningiz>
```

Bular bo'lmasa sayt `Missing Supabase environment variable(s): SUPABASE_URL,
SUPABASE_PUBLISHABLE_KEY` xatosi bilan oq ekran beradi. Cloudflare, Render va
local serverda "ishlamayapdi" muammosining eng ko'p uchraydigan sababi shu.
Qolgan ixtiyoriy qiymatlar: `.env.example`.

## 1. Local server (production rejimini sinash)

```bash
bun install
bun run build:node
bun run start        # http://localhost:3000
```

`bun run dev` — faqat ishlab chiqish uchun (http://localhost:8080).
`.env` fayl loyiha ildizida bo'lishi kerak.

## 2. Cloudflare Workers

```bash
bun run build:cloudflare
bunx wrangler deploy
```

`wrangler.toml` tayyor: `nodejs_compat` yoqilgan, static fayllar `.output/public`,
entry `.output/server/index.mjs`.

**Muhim (o'quvchi/o'qituvchi qo'shish shu kalitlarga bog'liq).** Login yaratish
serverda `SUPABASE_SERVICE_ROLE_KEY` bilan ishlaydi. Bu kalit Worker'da bo'lmasa
"Server sozlamasi to'liq emas" xabari chiqadi. Uchta runtime secret'ni kiriting:

```bash
bunx wrangler secret put SUPABASE_URL
bunx wrangler secret put SUPABASE_PUBLISHABLE_KEY
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Yoki Cloudflare Dashboard > Workers & Pages > (loyiha) > Settings >
Variables and Secrets > **Add** > type **Secret**. Qo'shgandan keyin qayta deploy
qiling (Workers Builds bo'lsa "Retry deployment").

`VITE_SUPABASE_URL` va `VITE_SUPABASE_PUBLISHABLE_KEY` — build vaqtidagi
qiymatlar (secret emas): Workers Builds sozlamalarida yoki CI env'da bo'lishi
shart, aks holda client bundle bo'sh konfiguratsiya bilan quriladi.

Cron uchun `wrangler.toml` ga `[triggers] crons = [...]` qo'shib
`/api/public/cron/*` yo'llarini `Authorization: Bearer $CRON_SECRET` bilan chaqiring.


## 3. Render (Node web service)

- Build Command: `bun install && bun run build:node`
- Start Command: `bun run start` (yoki `node .output/server/index.mjs`)
- Environment: yuqoridagi barcha `VITE_*` va server qiymatlari.
- Render `PORT` ni o'zi beradi — kodga qo'l tegizish shart emas.
- Health Check Path: `/api/public/health/live`

## 4. Vercel

Hech narsa o'zgartirmasa ishlaydi: `NITRO_PRESET` berilmasa `vercel` preseti
tanlanadi. Batafsil: `VERCEL_DEPLOY.md`.

## 5. Lovable preview / publish

Lovable build muhitida `NITRO_PRESET` ataylab e'tiborsiz qoldiriladi va har doim
Cloudflare worker quriladi. Yuqoridagi presetlar faqat o'zingizning
serveringizda/CI'da ta'sir qiladi.

## 6. Deploydan keyin tekshirish

```
GET /api/public/health/live    -> 200
GET /api/public/health/ready   -> 200 {"status":"ready"}
GET /api/public/health/config  -> 200 {"status":"ok","can_create_users":true}
```

`ready` 503 qaytarsa — server env'da `SUPABASE_URL` yoki
`SUPABASE_PUBLISHABLE_KEY` yo'q.

`config` 503 qaytarsa — `missing` ro'yxatidagi kalitlarni Worker secret sifatida
qo'shing. `can_create_users: false` bo'lsa o'quvchi/o'qituvchi qo'shish ishlamaydi.
Bu endpoint hech qanday kalit qiymatini ko'rsatmaydi, faqat true/false.


## 7. Lovable'dan to'liq ajralib ishlatish (o'z Supabase + Cloudflare)

Kod Lovable'siz ishlaydi. Lovable'ga bog'liq faqat ikki narsa bor: baza
(Lovable Cloud) va ixtiyoriy AI kaliti.

### 7.1 Ma'lumotlarni ko'chirish
1. Lovable Cloud yoqilgan bo'lishi shart (to'xtatilgan bazadan dump olinmaydi).
2. Lovable: More → Database → Manage → Settings → Export data → `.backup` fayl.
3. O'z Supabase loyihangizni oching, `public` + `auth` sxemalarini tiklang
   (`pg_restore` — loginlar `auth.users` bilan birga ko'chadi, parollar saqlanadi).
   Faqat sxema kerak bo'lsa: `supabase/migrations` va `drizzle/migrations`.
4. Fayl ombori (Face ID rasmlari, logolar) — bucket'larni alohida ko'chiring.
5. `private.*` funksiyalar, triggerlar va RLS dump ichida keladi — alohida qo'lda
   yozish shart emas. Tiklagandan keyin `GET /api/public/health/ready` ni tekshiring.

### 7.2 Cloudflare sozlamasi
Build vaqtida: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_SUPABASE_PROJECT_ID` — yangi loyihaniki. `wrangler.toml` dagi eski
`SUPABASE_URL` ni ham almashtiring.

```bash
bunx wrangler secret put SUPABASE_URL
bunx wrangler secret put SUPABASE_PUBLISHABLE_KEY
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
bunx wrangler secret put TELEGRAM_BOT_TOKEN
bunx wrangler secret put TELEGRAM_WEBHOOK_SECRET
bunx wrangler secret put CRON_SECRET
bunx wrangler secret put APP_BASE_URL
# AI — bittasi yetarli (ustuvorlik: OpenAI → Gemini → Lovable)
bunx wrangler secret put OPENAI_API_KEY      # Jarvis + ovoz
bunx wrangler secret put GEMINI_API_KEY      # Jarvis matn (ovozsiz)
```

Ixtiyoriy: `JARVIS_AI_MODEL` (asosiy model), `JARVIS_FAST_MODEL` (kunlik hisobot
va ota-ona bot qisqa javoblari), `TELEGRAM_AI_ENABLED=true`.
Hech bir AI kaliti bo'lmasa ham tizim ishlaydi: hisobot va bot AI xulosasiz,
oddiy raqamlar bilan yuboriladi.

### 7.3 Telegram va avtomatik ishlar
- Webhook: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<domen>/api/public/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>`
- Cron (`wrangler.toml` → `[triggers] crons`) yoki yangi bazadagi `pg_cron`:
  - `0 16 * * *` → `/api/public/cron/daily-report` (21:00 Toshkent)
  - oylik hisoblar va eslatmalar → `/api/public/cron.*` yo'llari
  - Har biri `Authorization: Bearer $CRON_SECRET` bilan.
- Eski bazadagi `pg_cron` ishlarini (Lovable Cloud) o'chiring, aks holda ikki marta yuboriladi.

### 7.4 Lovable'ga xos ixtiyoriy qismlar
- `src/routes/mcp.ts`, `src/routes/[.mcp]/*`, `src/lib/mcp/*` — Lovable MCP ulanishi.
  Oddiy npm paket, Cloudflare'da ham ishlaydi; kerak bo'lmasa o'chirib tashlash mumkin.
- `@lovable.dev/vite-tanstack-config` — oddiy build paketi, qoldiring.

### 7.5 Domenlar va o'tish tartibi
1. Avval `*.workers.dev` manzilida yangi baza bilan to'liq sinang.
2. Dam olish kunida yakuniy dump → tiklash → Telegram webhook'ni almashtiring.
3. Cloudflare Workers → Custom Domains: `akhmadacademy.life`, `ilmnuri.xyz`.
   Markaz `host` sarlavhasi bo'yicha aniqlanadi — ILM NURI o'z brendi bilan ochiladi.
4. Lovable'dagi domenlarni uzing.
