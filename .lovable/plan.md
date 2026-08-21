# Cloudflare'da o'quvchi/o'qituvchi qo'shish ishlamasligini tuzatish

## Holat

Lovable preview'da o'quvchi/o'qituvchi qo'shish ishlaydi, Cloudflare'ga qo'yilgan
nusxada esa ishlamaydi. Kodda bu amal (`createManagedUser`) serverda ishlaydi va
uchta server kalitiga bog'liq:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Bu kalitlar Cloudflare Worker'da bo'lmasa, server funksiya darhol xato beradi va
oynada faqat umumiy "Xatolik" ko'rinadi — shuning uchun sabab yashirin qolyapti.
Cloudflare hisobingizdagi maxfiy qiymatlarni bu yerdan ko'ra olmayman, shuning
uchun bu eng ehtimolli sabab, lekin hozircha tasdiqlanmagan. Reja birinchi qadam
sifatida shuni aniqlaydi.

## Bosqichlar

1. **Diagnostika endpoint'i**: `/api/public/health/config` qo'shiladi. Faqat
   "bor/yo'q" (true/false) ro'yxatini qaytaradi, hech qanday kalit qiymati
   ko'rsatilmaydi. Cloudflare manzilida ochib, qaysi sozlama yo'qligini bir
   ko'rishda aniqlaymiz.
2. **Aniq xato xabari**: `createManagedUser` va tegishli modallar (o'quvchi
   qo'shish, `NewTeacherModal`, `settings/credentials`) endi "server sozlamasi
   to'liq emas" kabi tushunarli xabar chiqaradi, umumiy "Xatolik" emas.
3. **Cloudflare sozlash yo'riqnomasi**: `DEPLOY.md` ichida aynan qaysi
   `wrangler secret put ...` buyruqlari yoki Cloudflare Dashboard > Worker >
   Settings > Variables and Secrets qadamlarini bajarish kerakligi qisqa va
   aniq yoziladi (build vaqtidagi `VITE_*` va runtime secret farqi bilan).
4. **Tekshirish**: sozlamalar qo'yilgach, Cloudflare manzilida bitta test
   o'qituvchi qo'shib, endpoint va oyna natijasi bo'yicha tasdiqlanadi.

## Texnik izohlar

- Yangi endpoint `src/routes/api/public/health.config.ts` — mavjud
  `health.ready.ts` uslubida, `process.env` faqat handler ichida o'qiladi va
  natijada faqat `Boolean(...)` qiymatlar qaytadi.
- `src/lib/user-admin.functions.ts` ichida `client.server` importi
  `try/catch` bilan o'raladi va sozlama yetishmasa `{ ok: false, error: ... }`
  ko'rinishida qaytariladi (hozir u kutilmagan istisno bo'lib chiqadi).
- Ma'lumotlar bazasi sxemasi va RLS o'zgarmaydi.
