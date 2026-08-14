# GitHub va Vercelga joylash — sodda yo'riqnoma

## 1. Tayyor ZIP'ni ochish

ZIP faylni kompyuteringizga yuklab oling va **Extract all / Извлечь все** qiling. Ochilgan papkaning ichida quyidagilar bevosita ko'rinishi kerak:

- `package.json`
- `src`
- `public`
- `supabase`
- `vercel.json`
- `README.md`

GitHub'ga ZIP faylning o'zini yoki yana bitta tashqi papkani yuklamang. Yuqoridagi fayllarning o'zini yuklang.

## 2. GitHub repository'ga yuklash

1. `https://github.com/Odil005/akhmad-academy-crm` sahifasini oching.
2. **Add file → Upload files** ni bosing.
3. Ochilgan ZIP ichidagi barcha fayl va papkalarni sahifaga sudrab tashlang.
4. `.env`, `node_modules`, `.output`, `.vercel` nomli fayl/papkalar yo'qligini tekshiring.
5. Commit matniga `UNICRM production tayyor versiya` deb yozing.
6. **Commit changes** ni bosing.

Yuklash tugagach repository bosh sahifasida `package.json`, `src`, `supabase` va `vercel.json` ko'rinsa — to'g'ri joylangan.

## 3. Supabase bazasini yangilash

Hozir ishlatayotgan Supabase loyihangizda avvalgi migratsiyalar bor bo'lsa, `supabase/migrations` papkasidagi hali bajarilmagan yangi migratsiyalarni nomidagi sana-vaqt tartibida qo'llang. Telegram bot uchun eng oxirgi majburiy fayl: `supabase/migrations/20260814100000_telegram_bot_production.sql`.

Yangi, bo'sh Supabase loyiha ochilgan bo'lsa, `supabase/migrations` ichidagi barcha SQL fayllarni nomidagi sana-vaqt tartibida qo'llash kerak. Bir faylni ikki marta qo'lda ishga tushirmang.

## 4. Vercelga ulash

1. Vercelga kiring va **Add New → Project** ni bosing.
2. GitHubdagi `Odil005/akhmad-academy-crm` repository'sini tanlab **Import** qiling.
3. Build sozlamalarini o'zgartirmang: loyiha ichidagi `vercel.json` ularni belgilaydi.
4. **Environment Variables** bo'limiga `.env.example` dagi majburiy nomlarni kiriting.

Majburiy qiymatlar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_BASE_URL`
- `CRON_SECRET`

Telegram ishlatilsa qo'shiladi:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_AI_ENABLED` (`false` tavsiya qilinadi)

`APP_BASE_URL`ga Vercel bergan yakuniy manzilni kiriting, masalan `https://akhmad-academy-crm.vercel.app`. Qiymatlarni GitHub fayliga yozmang.

## 5. Yakuniy sinov

Deploy muvaffaqiyatli tugagach Vercel bergan linkni oching va administrator sifatida kiring. Quyidagilarni tekshiring:

- Dashboarddagi to'rtta moliyaviy/o'quvchi ko'rsatkichi real raqam ko'rsatadi.
- O'quvchilar, guruhlar va dars jadvali o'rtasida sahifa qayta yuklanmasdan o'tadi.
- Yangi o'quvchi, guruh, dars, davomat va to'lov test yozuvi saqlanadi.
- Administrator tizim xatosi indikatorini ko'ra oladi.
- Telegram bot test xabarini yuboradi.

Muammo chiqsa Vercel'dagi **Deployment → Logs** va CRMdagi **Sozlamalar → Tizim holati** bo'limini tekshiring. Maxfiy kalitlarni skrinshotda ham ulashmang.
