# Telegram bot tokenini yangilash va webhookni o'rnatish

## Holat

Hozir `TELEGRAM_BOT_TOKEN` eski 'ga tegishli. Yangi bot — `@AkhmadAcademylifebot` — tokeni saqlanishi va webhook o'rnatilishi kerak.

## Amallar

1. **Tokenni yangilash** — `update_secret` vositasi orqali `TELEGRAM_BOT_TOKEN` uchun forma ochiladi. Foydalanuvchi yangi tokenni kirgizadi va saqlaydi.
2. **Botni tekshirish** — `getMe` Telegram API metodini chaqirib bot identifikatorini va username'ini tasdiqlash.
3. **Webhook o'rnatish** — CRM ichidagi "Sozlamalar → Telegram → Webhook o'rnatish" tugmasi orqali (yoki to'g'ridan-to'g'ri API chaqiruv bilan) webhook URL'ini `@AkhmadAcademylifebot`'ga bog'lash.
4. **Test xabari** — CRM'dan yoki to'g'ridan-to'g'ri test xabari yuborib botning haqiqatan ishlayotganini tasdiqlash.

## Natija

Bot to'liq ishlaydi: ota-ona, o'quvchi, o'qituvchi va direktor uchun barcha menyular faol.