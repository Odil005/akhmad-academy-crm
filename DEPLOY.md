# Deploy: local server, Cloudflare, Render, Vercel

Bitta kod bazasi, to'rt xil server. Server turi `NITRO_PRESET` bilan tanlanadi.

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

Bu to'rttasi bo'lmasa sayt "Missing Supabase environment variable(s): SUPABASE_URL,
SUPABASE_PUBLISHABLE_KEY" xatosi bilan oq ekran beradi. Cloudflare/Render/local
serverda muammoning eng ko'p uchraydigan sababi shu.

Qolgan ixtiyoriy qiymatlar: `.env.example`.

## 1. Local server (production rejimida sinash)

```bash
bun install
bun run build:node
bun run start        # http://localhost:3000
```

`bun run dev` — faqat ishlab chiqish uchun (http://localhost:8080).

## 2. Cloudflare Workers

```bash
bun run build:cloudflare
bunx wrangler deploy
```

`wrangler.toml` tayyor (`nodejs_compat` yoqilgan, static fayllar `.output/public`).
Secretlarni `bunx wrangler secret put SUPABASE_URL` ko'rinishida kiriting.
`VITE_*` qiymatlari build paytida `.env` yoki CI env'da bo'lishi shart.

Cloudflare'da cron: `wrangler.toml` ga `[triggers] crons = [...]` qo'shib,
`/api/public/cron/*` yo'llarini `Authorization: Bearer $CRON_SECRET` bilan chaqiring.

## 3. Render (Node web service)

- Build Command: `bun install && bun run build:node`
  (yoki npm bilan: `npm ci && NITRO_PRESET=node_server npm run build`)
- Start Command: `bun run start` (yoki `node .output/server/index.mjs`)
- Environment: yuqoridagi barcha `VITE_*` va server qiymatlari.
- Render `PORT` ni o'zi beradi — kodga qo'l tegizish shart emas.
- Health check path: `/api/public/health/live`

## 4. Vercel

Hech narsa o'zgartirmasa ham ishlaydi: `NITRO_PRESET` berilmasa `vercel` preseti
tanlanadi. Batafsil: `VERCEL_DEPLOY.md`.

## 5. Deploydan keyin tekshirish

```
GET /api/public/health/live    -> 200
GET /api/public/health/ready   -> 200 {"status":"ready"}
```

`ready` 503 qaytarsa — server env'da `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` yo'q.
