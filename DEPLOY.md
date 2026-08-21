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
```

`ready` 503 qaytarsa — server env'da `SUPABASE_URL` yoki
`SUPABASE_PUBLISHABLE_KEY` yo'q.
