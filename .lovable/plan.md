# Akhmad Academy CRM — raqobatchilardan ustun bo'lish rejasi

Maqsad: EduTizim va Soff CRM'da bor narsalar bizda ham bo'lishi kifoya emas — ular qilmaydigan 4 ta narsa bilan ajralib turamiz: **avtomatik pul undirish**, **ota-ona bilan real vaqtli aloqa**, **o'quvchi natijasini ko'rsatadigan analitika** va **Jarvis AI boshqaruvchisi**.

Reja 4 bosqichga bo'lingan. Har bosqich alohida ishlaydi, ketma-ket bajaramiz.

---

## 1-bosqich. Pul oqimi avtomatlashtirilgan (eng katta ta'sir)

- **Qarzdorlar paneli** — kim, qancha, necha kun kechikkan, oxirgi aloqa qachon bo'lgani bilan bitta ro'yxat. Bir tugma bilan Telegram eslatma yoki qo'ng'iroq.
- **Bosqichma-bosqich eslatma zinapoyasi** — to'lovga 3 kun qolganda muloyim eslatma, to'lov kuni xabar, 3/7/14 kun kechikkanda kuchayib boruvchi matn. Ota-ona javob berса Jarvis o'zi tushuntiradi.
- **To'lov rejasi (bo'lib to'lash)** — qarzni 2-3 qismga bo'lib grafik tuzish, har qismga avtomatik eslatma.
- **Chegirma va aksiya qoidalari** — aka-uka chegirmasi, yillik oldindan to'lov, "do'stini olib kel" bonusi — qo'lda hisoblash yo'q.
- **Kunlik kassa yopilishi** — kun oxirida naqd/karta/online bo'yicha solishtiruv (sverka) va direktorga Telegram xulosa.

## 2-bosqich. Ota-ona kabineti (Telegram Mini App)

- Telegram bot ichida ochiladigan chiroyli mini-ilova: farzandning **davomati, baholari, xulq bahosi, to'lov holati, video darslari** bir joyda.
- **O'qituvchi bilan to'g'ridan-to'g'ri chat** — bot orqali, tarixi CRM'da saqlanadi.
- **Ruxsat so'rash** ("bugun kelmaydi, kasal") — administrator tasdiqlaydi, davomatga avtomatik tushadi.
- **Haftalik avtomatik xulosa** — "Shu hafta 5 darsdan 5, o'rtacha baho 4.6, keyingi to'lov 5-sentabr".
- Ota-ona ilovaga bir marta ulanadi, keyin login/parol kerak emas.

## 3-bosqich. O'quvchi natijasi va ushlab qolish (churn oldini olish)

- **Ketish xavfi ballari** — davomat pasayishi, to'lov kechikishi, xulq bahosi va faollikka qarab har o'quvchiga "xavf" darajasi. Xavfli o'quvchilar administrator ish ro'yxatiga avtomatik tushadi.
- **O'quvchi rivoji sahifasi** — baho grafigi, davomat trendi, test natijalari, maqsad xaritasi progressi — ota-onaga ham ko'rinadi.
- **Sertifikat va reyting** — kurs oxirida avtomatik PDF sertifikat, guruh va markaz bo'yicha reyting jadvali, bonus ballar do'kon (marketplace) bilan bog'lanadi.
- **Test/uy vazifa moduli** — o'qituvchi vazifa beradi, o'quvchi ilovada bajaradi, natija avtomatik bahoga aylanadi.

## 4-bosqich. Jarvis — direktorning biznes sherigi

- **Prognoz**: oy oxirigacha kutilayotgan tushum, xavf ostidagi summa, guruh to'ldirish prognozi.
- **Kunlik brifing** (20:00 dagi hisobotga qo'shimcha): "Bugun 3 o'quvchi ketish xavfida, 2 guruhda o'qituvchi kechikdi, kassada 400 ming farq bor".
- **Savol-javob**: "sentabrda qancha ishladik?", "eng kuchli o'qituvchi kim?", "bo'sh xona qachon bor?" — darhol javob + kerakli sahifani ochish.
- **Amal bajarish**: Jarvis to'g'ridan-to'g'ri eslatma yuborishi, guruh yaratishi, to'lov rejasi tuzishi mumkin (tasdiqlash bilan).
- **Anomaliya ogohlantirishi** — g'ayrioddiy chegirma, o'chirilgan to'lov, kechki kirish kabi holatlarda direktorga darhol xabar.

---

## Qo'shimcha ustunliklar (tez qo'shiladigan, kichik ishlar)

- Ko'p filial qo'llab-quvvatlash (filial bo'yicha kassa, jadval, hisobot ajratilgan).
- Rollar va ruxsatlar matritsasi + to'liq audit jurnali (kim nimani o'zgartirgani).
- Ma'lumotni Excel/PDF ga eksport va avtomatik zaxira nusxa.
- Offline rejim: internet uzilganda davomat qurilmada saqlanadi, ulanish qaytganda yuklanadi.
- Ish e'lonlari/qo'ng'iroqlar bilan lid voronkasi: lid → sinov darsi → shartnoma → to'lov konversiyasi ko'rinadigan bo'ladi.

## Texnik qism

- Yangi jadvallar: `payment_plans`, `payment_reminders` (zinapoya holati), `discount_rules`, `student_risk_scores`, `parent_requests`, `assignments` + `assignment_submissions`, `cash_shifts` (kunlik yopilish), `branches` (ko'p filial), `audit_log` kengaytmasi.
- Barcha jadvalga RLS + GRANT: ota-ona ma'lumoti faqat o'z farzandi, o'qituvchi faqat o'z guruhi, admin/direktor to'liq.
- Avtomatik ishlar `src/routes/api/public/cron/*` orqali (mavjud `CRON_SECRET` bilan): eslatma zinapoyasi, xavf ballarini qayta hisoblash, haftalik xulosa, kassa yopilishi.
- Telegram Mini App — `src/routes/parent/*` ostida yengil, alohida bundle; bot `web_app` tugmasi bilan ochadi, kirish bir martalik token orqali.
- Prognoz va brifing uchun mavjud Lovable AI gateway (`jarvis-ai.server.ts`) ishlatiladi; hisob-kitob (og'ir agregatsiya) SQL funksiyalarida bo'ladi, shuning uchun tezlik pasaymaydi.
- Har bosqich oxirida xavfsizlik skaneri va tezlik tekshiruvi o'tkaziladi.

## Boshlash tartibi

1-bosqich (qarzdorlar + eslatma zinapoyasi + kassa yopilishi) — darhol pul olib keladi, shundan boshlaymiz. Keyin 2-bosqich (ota-ona Mini App), so'ng 3 va 4.
