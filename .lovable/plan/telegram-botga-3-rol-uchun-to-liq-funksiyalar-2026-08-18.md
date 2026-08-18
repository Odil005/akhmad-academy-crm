# Telegram botga 3 rol uchun to'liq funksiyalar

Botda hozir ota-ona, o'quvchi va umumiy "xodim" menyusi bor. O'qituvchi va direktor bir xil menyudan foydalanadi, funksiyalar esa kam. Reja: uchta aniq rol menyusi — **o'qituvchi**, **o'quvchi**, **direktor** — va har biriga to'liq ishlaydigan bo'limlar.

## O'quvchi menyusi

- 📅 Darslarim — bugungi va ertangi darslar, xona va o'qituvchi bilan
- 🗓 Haftalik jadval — 7 kunlik dars jadvali
- ✅ Davomatim — 30 kunlik foiz, kelmagan kunlar ro'yxati
- 💳 To'lovim — oxirgi to'lovlar, qarz summasi, keyingi to'lov sanasi
- 🏆 Natijalarim — baho/xulq (behavior) yozuvlari va o'rtacha ko'rsatkich
- 🎥 Video darslar — guruhiga biriktirilgan video darslar havolalari
- 👤 Profilim — guruhlar, o'qituvchilar, shaxsiy ma'lumot

## O'qituvchi menyusi

- 📅 Bugungi darslar — vaqt, guruh, xona, o'quvchilar soni
- ✅ Davomat kiritish — kiritilmagan darslar ro'yxati va bir tugmada "Hammasi keldi" / CRMga havola
- 👥 Guruhlarim — guruh va o'quvchilar soni, har bir guruh o'quvchilari ro'yxati
- 💬 Ota-ona xabarlari — yangi xabarlar va to'g'ridan-to'g'ri javob yozish (force_reply)
- 📈 Mening KPI — davomat kiritish foizi, guruhlardagi o'quvchi soni, oylik dars soni
- 💰 Balansim — teacher balance/oylik hisob-kitob ma'lumoti

## Direktor menyusi

- 📊 Kunlik hisobot — bugungi tushum, davomat, yangi lead, yangi o'quvchi
- 💵 Moliya — oylik tushum, kutilayotgan to'lov, kassa smenalari holati
- 🔴 Qarzdorlar — top qarzdorlar ro'yxati va umumiy qarz summasi
- 👥 O'quvchilar va guruhlar — umumiy statistika, fanlar bo'yicha taqsimot
- 👨‍🏫 O'qituvchilar — davomat kiritish holati, muammoli o'qituvchilar
- 📞 Lidlar — yangi murojaatlar va konversiya foizi
- 🛡 Tizim holati — bot, cron, navbatdagi xabarlar holati

## Umumiy xatti-harakat

- Rol `user_roles` jadvalidan tekshiriladi (hozirgidek), o'qituvchi faqat o'z guruh/o'quvchilarini, o'quvchi faqat o'zini ko'radi; direktor markaz bo'yicha ko'radi.
- Har bir bo'limda ma'lumot bo'lmasa aniq bo'sh-holat matni chiqadi (xato emas).
- Slash buyruqlar ham qo'shiladi: `/menu`, `/today`, `/attendance`, `/payment`, `/report`, `/debtors`, `/groups`, `/kpi`.
- Bosh menyu tugmasi har rolda o'z menyusini qaytaradi.

## Texnik qism

- `src/routes/api/public/telegram.webhook.ts`: `staffMenu(role)` o'rniga alohida `teacherMenu` va `directorMenu`; `handleStaffCommand` rolga qarab bo'linadi (`handleTeacherCommand`, `handleDirectorCommand`), `handleStudentCommand` yangi bo'limlar bilan to'ldiriladi.
- Yangi o'qish funksiyalari (guruhlar, KPI, moliya, qarzdorlar, video darslar, behavior) `supabaseAdmin` bilan faqat webhook ichida, kerakli ustunlar tanlanadi va limit qo'yiladi.
- Matn formatlash va uzun xabar bo'lish uchun mavjud `splitTelegramMessage` / `sendTelegramText` ishlatiladi; menyu matn konstantalari fayl boshida saqlanadi.
- Callback tugmalari (guruh tanlash, ota-onaga javob) mavjud `makeTeacherCallback`/`parseTeacherCallback` uslubida 64 bayt limitiga mos kodlanadi.
- Testlar: `tests/telegram/domain.test.ts` uslubida yangi callback/menyu yordamchilariga unit testlar.

## Eslatma

Bot real ishlashi uchun `TELEGRAM_BOT_TOKEN` va `TELEGRAM_WEBHOOK_SECRET` saqlangan bo'lishi va Sozlamalar → Telegram bo'limida "Webhook o'rnatish" bosilishi kerak. Kod tomondan hammasi tayyor bo'ladi.
