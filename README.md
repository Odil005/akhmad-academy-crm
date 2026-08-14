# UNICRM — o'quv markazi boshqaruv tizimi

O'quvchilar, o'qituvchilar, guruhlar, davomat, to'lovlar, moliya va hisobotlarni boshqarish uchun CRM.

## Asosiy imkoniyatlar

- O'quvchi va mijoz bazasi
- O'qituvchilar ro'yxati, darajasi va Telegram ulanishi
- Guruhlar, dars jadvali va davomat
- To'lovlar, qarzdorlik va moliya hisoboti
- Ota-onalarga xabarlar va Telegram integratsiyasi
- Excel import/eksport
- Vercel deploy uchun tayyor konfiguratsiya
- Tezkor jadval, rollar va video darslar uchun bazadagi himoya

## GitHub'ga yuklash

GitHub uchun tayyor ZIP'ni avval kompyuterda oching. Repository'ga ZIP faylning o'zini emas, uning ichidagi `package.json`, `src`, `supabase`, `public` va qolgan fayllarni yuklang.

`.env`, `node_modules`, `.output` va `.vercel` papkalarini GitHub'ga yuklamang. Ular tayyor paketga kiritilmagan.

Bosqichma-bosqich GitHub yo'riqnomasi: [GITHUB_YUKLASH.md](./GITHUB_YUKLASH.md).
To'liq deploy yo'riqnomasi: [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md).
Android/Play Market yo'riqnomasi: [PLAY_MARKET.md](./PLAY_MARKET.md).
Telegram bot yo'riqnomasi: [TELEGRAM_BOT_SETUP.md](./TELEGRAM_BOT_SETUP.md).
Telegram bot qabul testi: [TELEGRAM_BOT_TEST.md](./TELEGRAM_BOT_TEST.md).
Tizim arxitekturasi: [ARCHITECTURE.md](./ARCHITECTURE.md).

## Lokal ishga tushirish

```bash
bun install
bun run dev
```

## Tekshirish

```bash
bun run typecheck
bun run test
bun run build
```

## Muhim xavfsizlik qoidasi

Supabase service-role kaliti, Telegram tokeni va boshqa maxfiy qiymatlarni GitHub'ga yozmang. Ularni faqat Vercel'dagi **Environment Variables** bo'limida saqlang.
