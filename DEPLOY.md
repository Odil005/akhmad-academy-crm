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
entry `.output/server/index.mjs`. Secretlarni
`bunx wrangler secret put SUPABASE_URL` ko'rinishida kiriting. `VITE_*` qiymatlari
build paytida `.env` yoki CI env ichida bo'lishi shart.

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
```

`ready` 503 qaytarsa — server env'da `SUPABASE_URL` yoki
`SUPABASE_PUBLISHABLE_KEY` yo'q.
