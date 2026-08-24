# Direktor kunlik hisoboti — ulanish va sinov rejasi

## Hozirgi holat (tasdiqlangan)

Tizimda ikkala usul **allaqachon** ishlaydi:

1. **Link (avtomatik)** — Dashboarddagi "Tezkor Telegram ID yaratish" panelida Direktor tanlanadi → "Havola" tugmasi → bir martalik `t.me/AkhmadAcademylifebot?start=...` linki generatsiya qilinadi. Direkor linkni bossa, webhook `telegram_chat_id` ni avtomatik `director_report_recipients` jadvaliga yozadi (webhook 1687-qator).
2. **Qo'lda** — Sozlamalar → "Direktor kunlik hisoboti" bo'limida chat ID `TelegramIdField` orqali qo'lda kiritiladi.

Hisobot har kuni **21:00 Toshkent (16:00 UTC)** da `/api/public/cron/daily-report` orqali barcha faol qabul qiluvchilarga yuboriladi.

## Reja (faqat tekshiruv + sinov)

Kod o'zgartirish kerak emas — ikkala usul ham tayyor. Faqat quyidagi amallar bajariladi:

1. **Bot va webhook holatini tekshirish**
   - `getWebhookInfo` orqali `@AkhmadAcademylifebot` webhook manzili va holatini tasdiqlash.

2. **Direktor uchun qabul qiluvchi yozuvini tekshirish**
   - `director_report_recipients` jadvalida direktor uchun yozuv bormi (`telegram_chat_id`, `is_active=true`).
   - Agar yo'q bo'lsa: direktor user_id si bo'yicha `staff_telegram_links` dan chat ID olinadi va qabul qiluvchi sifatida qo'shiladi.

3. **Sinov xabari yuborish**
   - Sozlamalardagi "Sinov xabari yuborish" (`sendDirectorReportTest`) tugmasi orqali direktor chatiga "Ulanish tasdiqlandi" xabari yuboriladi — bu botning chat ga yetkaza olishini isbotlaydi.

4. **To'liq hisobotni qo'da ishga tushirish**
   - `/api/public/cron/daily-report` (POST) chaqirilib, real kunlik hisobot direktor chatiga yuboriladi va `director_daily_reports` jadvalida saqlanganini tasdiqlash.

5. **21:00 cron ro'yxatdan o'tganini tasdiqlash**
   - `pg_cron` job'lari ro'yxati tekshiriladi; `director_daily_report` job 16:00 UTC da rejada turgani tasdiqlanadi (yo'q bo'lsa qo'shiladi).

## Natija

Direktor ikkala usul orqali (link yoki qo'la) ulanadi, sinov xabari keladi, va har kuni 21:00 da to'liq hisobot avtomatik tushadi.
