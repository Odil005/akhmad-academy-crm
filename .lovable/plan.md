# Telegram Mini App + yangi o'quvchi ro'yxatdan o'tishi

## Maqsad
@AkhmadAcademylifebot ichida "Ilovani ochish" tugmasi bo'ladi. Hamma bot orqali ilovani ochadi; bot kim ekanini aniqlab mos ekranni ko'rsatadi:
- Xodim (direktor/admin/o'qituvchi) -> CRM (1-namuna, qoramtir ko'k).
- Ota-ona -> farzand ekrani (2-namuna, och rang).
- Yangi odam -> ro'yxatdan o'tish ekrani.

## Yangi o'quvchi oqimi
1. Mini App ichida rol tanlanadi (O'quvchi / Ota-ona), ism, familiya, telefon (Telegram kontakti orqali tasdiqlanadi), qiziqqan fan.
2. Tizim avtomatik username va parol yaratadi, ularni faqat shu Telegram chatga yuboradi.
3. Holat "Tasdiq kutilmoqda": o'quvchi faqat ilovadagi cheklangan ekranni (markaz haqida, kurslar, holat) ko'radi; guruh, davomat, to'lov yo'q.
4. Admin CRM'da "Yangi arizalar" ro'yxatida ko'radi -> guruhni tanlab "Tasdiqlash" yoki "Rad etish".
5. Tasdiqlangach o'quvchi guruhga qo'shiladi, botga xabar boradi, to'liq ilova ochiladi.

## Kirish
Mini App Telegram imzolangan ma'lumoti (initData) bilan server tomonida tekshiriladi va avtomatik kiradi — parol so'ralmaydi. Saytdan kirish uchun yaratilgan login/parol ham ishlaydi.

## Texnik qism
- `/tg` route: Telegram WebApp SDK, initData HMAC tekshiruvi server function'da (bot tokeni gateway orqali emas, shuning uchun alohida secret `TELEGRAM_BOT_TOKEN` kerak bo'lishi mumkin — tekshiriladi).
- Bot menyu tugmasi `setChatMenuButton` (web_app URL) gateway orqali.
- Yangi jadval `student_applications` (center_id, telegram chat, rol, holat pending/approved/rejected, RLS: faqat o'z markazi admin/direktori).
- Login yaratish mavjud managed-account xizmati orqali; pending foydalanuvchiga `student` roli berilmaydi, faqat `applicant` holati — shu sabab CRM jadvallariga kirmaydi.
- Tasdiqlash server function: rol tekshiruvi, o'quvchi + primary group yozish (mavjud enrollment trigger), Telegram xabari.
- Testlar: pending foydalanuvchi guruh ko'rmasligi, faqat admin tasdiqlashi.

## Tekshiruv
Mini App'ni haqiqiy Telegram'da ochib bo'lmaydi sandboxda; initData tekshiruvi test bilan, ekranlar brauzerda sinaladi. Haqiqiy telefonda siz sinab ko'rasiz.

## Rasmlar
Namuna: telegram-ilova-namuna-1-xodim.jpg, telegram-ilova-namuna-2-ota-ona.jpg (Files).
