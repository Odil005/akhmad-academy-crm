# Telegram bot qabul testi

Bu ro'yxat bot Vercel va Supabase'ga chiqarilgandan keyin bir marta to'liq bajariladi.

## Tayyorlik

- Supabase'da `20260814100000_telegram_bot_production.sql` migratsiyasi bajarilgan.
- Vercel'da `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`, `APP_BASE_URL`, `SUPABASE_URL` va `SUPABASE_SERVICE_ROLE_KEY` kiritilgan.
- CRM → Sozlamalar → Telegram / SMS sahifasida `Bot va webhook ishlayapti` yashil holatda.
- `TELEGRAM_AI_ENABLED=false`; AI faqat alohida rozilik bo'lsa yoqiladi.

## Rollar bo'yicha sinov

1. **O'quvchi:** bir martalik havoladan ulanadi; darslar, davomat, to'lov va profil faqat o'ziga tegishli chiqadi.
2. **Ota-ona:** telefon/contact yoki bir martalik havoladan ulanadi; faqat o'z farzandi ma'lumotlarini ko'radi.
3. **O'qituvchi:** bugungi darslari, kiritilmagan davomat va ota-ona xabarlarini ko'radi; boshqa o'qituvchining guruhi ochilmaydi.
4. **Administrator:** markaz hisoboti, qarzdorlik, bot holati va bugungi darslarni ko'radi.
5. **Direktor:** administrator imkoniyatlari va direktor hisobotlari ishlaydi.

## Xavfsizlik va barqarorlik

1. Bir martalik ulanish havolasi ikkinchi marta ishlamaydi.
2. Noto'g'ri yoki muddati o'tgan havola hisobni ulamaydi.
3. Bir o'quvchining Telegram chatini boshqa o'quvchiga biriktirish rad etiladi.
4. Telegram bir xil `update_id`ni qayta yuborsa, javob yoki yozuv takrorlanmaydi.
5. Telegram vaqtincha ishlamasa, yuborish avtomatik qayta urinadi.
6. Xabarlar Telegram'da forwardingdan himoyalangan.
7. Bot guruh chatida shaxsiy ma'lumot bermaydi.
8. CRM'dagi `Test xabari` tugmasi real xabar yuboradi.
9. Vercel logida bot tokeni yoki service-role kaliti ko'rinmaydi.
10. Webhook holatida `pending_update_count` yig'ilib qolmaydi va oxirgi xato bo'sh bo'ladi.

## Qabul mezoni

Barcha bandlar muvaffaqiyatli o'tsa, bot production foydalanishga tayyor hisoblanadi. Biror band o'tmasa, token yoki maxfiy kalitni chatga yubormang; Vercel logidagi maxfiy ma'lumotsiz xato matnini tekshiring.
