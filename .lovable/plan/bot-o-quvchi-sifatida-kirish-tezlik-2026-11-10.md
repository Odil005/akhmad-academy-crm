# Bot: o'quvchi sifatida kirish + tezlik

## Hozirgi holat (tekshirildi)
- Bot raqamni faqat o'qituvchi (xodim) va ota-ona (o'quvchining ota-ona raqami) bo'yicha taniydi. O'quvchining o'z raqami tekshirilmaydi.
- 773171327 raqami o'quvchilar jadvalida yo'q; u faqat ikkita xodim profilida turibdi (biri "Soatmurod Test Bekpolatov").

## Qilinadigan ishlar
1. **Sizni o'quvchi sifatida qo'shish**: "Soatmurod Bekpolatov" nomli test o'quvchi yaratiladi (telefon 998773171327, ota-ona raqami ham shu), hech qaysi guruhga qo'shilmaydi (kerak bo'lsa keyin admin qo'shadi).
2. **Login yaratish**: o'quvchi uchun username (`soatmurod.bekpolatov1327`) va kirish kodi yaratiladi. Kod chatga yozilmaydi — u botingizga Telegram orqali yuboriladi va Sozlamalar → Loginlar'da ko'rinadi.
3. **Bot o'quvchini taniydi**: raqam yuborilganda tartib: o'qituvchi → o'quvchining o'z raqami → ota-ona raqami. O'quvchi topilsa, chat unga bog'lanadi va o'quvchi menyusi (davomat, to'lov, baholar, "Ilovani ochish") chiqadi. Sizning raqamingiz xodim profilida ham bor — xodim sifatida tanilmasligi uchun test profilidagi raqam to'qnashuvini tekshiraman; agar xodim sifatida qolishi kerak bo'lsa, bot ikki rolni tanlash tugmasini beradi.
4. **Sekin javob**: bot logida har bir javob vaqtini o'lchayman. Taxminiy sabablar (tekshiriladi, tasdiqlanmagan): har xabarda ketma-ket bir nechta baza so'rovlari va katta ro'yxat (candidatePool) yuklanishi. Tuzatish: Telegramga darhol "ok" qaytarib, ishni fonda bajarish, so'rovlarni parallel qilish, "yozmoqda…" belgisini darhol ko'rsatish.

## Texnik
- `telegram.webhook.ts` contact bo'limiga students telefon qidiruvi (yangi RPC `telegram_student_by_own_phone`, center_id hisobga olinadi).
- Student + student_credentials + user_roles(student) + user_centers — mavjud `decideApplication` yo'li qayta ishlatiladi.
- Webhook'da `ctx.waitUntil` bilan fon ishlov, vaqt loglari.
