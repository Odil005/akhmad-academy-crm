# 20 o'quv markazga tarqatish (multi-tenant) qo'llanmasi

Bu CRM bitta markaz uchun ishlab chiqilgan, lekin 20 markazga tarqatish uchun ikki
yo'l bor. Amalda eng tez va xavfsiz yo'l — **1-variant**.

## 1-variant (tavsiya): har markaz uchun alohida nusxa

Har bir markaz o'z bazasi va o'z domeni bilan ishlaydi. Ma'lumot 100% ajratilgan.

Har bir markaz uchun bajariladigan qadamlar:

1. Loyihani `Remix`/nusxa qilib yangi backend (Lovable Cloud) ulanadi.
2. Migratsiyalar avtomatik qo'llanadi (`supabase/migrations`).
3. Sozlamalar (`Sozlamalar → Aloqa / Dizayn`) orqali brend kiritiladi:
   markaz nomi, logotip, rang, telefon, manzil.
4. Sirlar kiritiladi: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`.
   Har markaz uchun **alohida Telegram bot** yaratilishi shart.
5. Direktor logini `Sozlamalar → Foydalanuvchi loginlari` bo'limida yaratiladi.
6. Kunlik hisobot 21:00 uchun `cron.daily-report` endpointi markaz domeniga ulanadi.

Narxlash uchun tayyor model: har markaz oyiga abonent to'lovi + bir martalik sozlash.

## 2-variant: bitta bazada ko'p markaz (kelgusi bosqich)

Agar barcha markazlar bitta bazada bo'lishi kerak bo'lsa, quyidagi ishlar zarur:

- `branches` jadvali (nom, manzil, telefon, logotip, is_active).
- Barcha asosiy jadvallarga `branch_id` (students, groups, lessons, payments,
  expenses, transactions, attendance, cash_shifts, leads).
- `user_branches` jadvali va `private.has_branch(uuid, uuid)` yordamchi funksiyasi.
- Har bir RLS siyosatiga `branch_id` sharti qo'shiladi (director faqat o'z filialini
  ko'radi, super-admin hammasini).
- Hisobot va cron ishlari `branch_id` bo'yicha guruhlanadi.

Bu ish katta migratsiya talab qiladi — buyruq bersangiz bosqichma-bosqich bajaramiz.

## Yetkazib berish paketi (har markazga)

- Direktor va administrator loginlari
- Telegram bot va webhook sozlamasi
- Excel import shabloni (o'quvchi/o'qituvchi)
- Metodika kutubxonasi (fan + daraja bo'yicha tayyor bazasi)
- 1 soatlik o'qitish sessiyasi va PDF qo'llanma
