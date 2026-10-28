# Roadmap

## 2026-10-24 CRM tezligi va 50 GB
- [ ] Asosiy sahifalar va ortiqcha so‘rovlarni o‘lchash, aniqlangan sekinlikni tuzatish va qayta tekshirish; eskirgan qidiruvlarni bekor qilish va tarix o‘sishida ortiqcha yuklanishni oldini olish.
- [ ] 50 GB joy so‘rovi: joriy disk holatini tekshirish; disk to‘lmagan bo‘lsa avtomatik kattalashtirish vositasi qo‘llanmaydi, foydalanuvchiga boshqaruvdagi yo‘l ko‘rsatiladi.

## 2026-10-19 guruh haftalik jadvali
- [x] Guruhda hafta kunlari, boshlanish/tugash tanlovi; darslar guruh saqlanishi bilan tranzaksiyada yaratiladi. Jadval o‘zgarsa eski darslar o‘chirilmaydi, faol bo‘lmagan holda saqlanadi, qo‘lda kiritilgan darslar saqlanadi.
- [x] Guruh/dars hodisalari ochiq jadvalni yangilaydi; oynaga qaytilganda qayta o‘qiladi. 12 qoida sinovi o‘tdi; bazada Du/Chor/Ju 08–10 avtomatik yaratish va Se/Pay 10–12 ga o‘zgartirish tekshirildi, sinov guruhi tozalandi. Yig‘ilish xatosiz.
- [ ] Administrator oynasidan guruh yaratib boshqa ochiq jadvalda ko‘rishni yakuniy tekshirish — preview administrator sifatida kirilmagan.

## 2026-10-19 nom va o‘quvchi qo‘shish
- [x] Akhmad Academy nomi va mavjud to‘g‘ri logolar tekshirildi; eski saqlangan belgilar yangilanishi uchun rasm havolalari yangilandi. EduNest ekranda yo‘q, eski login domeni kirish mosligi uchun saqlandi.
- [x] Guruh kartasidan mavjud yoki yangi o‘quvchini qo‘shish oynasi qo‘shildi; yangi o‘quvchi asosiy guruh triggeri bilan tranzaksiyada biriktiriladi, login talab qilinmaydi. 4 mavjud guruh sinovi o‘tdi, sahifa yig‘ilishi xatosiz.
- [ ] Administrator sessiyasida yangi o‘quvchini saqlab guruh ro‘yxatidan qayta o‘qishni tekshirish — preview kirilmagan, o‘z akkaunti bilan avtomatik kirish mavjud emas; administrator previewga kirishi kerak.

## 2026-10-19 guruh, kamera va hisobot
- [x] Saqlangan 24 ta asosiy guruh biriktirishi tiklandi; import vaqtni hisobga oladi va noaniq moslikni rad etadi. Guruh tahriri saqlandi; individual oylik va tarixiy to‘lovlar o‘zgarmaydi. Mahalliy preview boshqa nusxa/ko‘rinishdan faqat bitta o‘quvchini o‘qidi; real 24 kishilik ro‘yxatni ekran orqali tekshirish hali tasdiqlanmagan.
- [x] USB va telefon/ichki kameralar qo‘llandi; kamera 640×480 da ishladi va 390×844 ekran sig‘di. Haqiqiy telefon kamerasi/yuzni tanish foydalanuvchi qurilmasida tekshirilishi kerak.
- [x] Akhmad Director bilan bog‘langan Telegram chatiga 19.10.2026 haqiqiy jami raqamlar bilan sinov hisoboti yuborildi; Telegram success va message_id 159 qaytardi.

## O‘lchangan tezlik — 2026-10-17
- [x] Admin sessiyasida mahalliy oldin/keyin o‘lchandi: Face ID 2.888→2.159 s, O‘quvchilar 1.279→0.966 s, To‘lovlar 1.669→0.962 s. Bitta juft o‘lchov, yuk ostidagi yoki published tezlik kafolati emas; 100X tasdiqlanmadi
- [x] Jarvis faqat tugma bosilganda yuklanadi; keraksiz uch sahifa preloaddi olib tashlandi, root auth subscription tozalanadi. Boshlang‘ich so‘rovlar 12–17 taga kamaydi; kirish/ruxsatlar o‘zgarmadi
- [x] Jarvis tugmasi suhbat oynasini ochdi, uch admin sahifasi ochildi, ekran xatosi yo‘q; 12 ruxsat/AI sinovi o‘tdi. Cloud xotira 55%, ulanish 10/60, tiqilinch yo‘q — kattaroq instance tavsiya qilinmadi

## Bot, hisob va yagona Face ID — 2026-10-17
- [~] O‘qituvchi o‘z telefon kontaktini yuborganda bot ulanishi qo‘shildi; rol, raqam va eski bog‘lanish tekshiriladi. Haqiqiy o‘qituvchi Telegram kontaktini yuborishi bilan yakuniy sinov kutilmoqda
- [x] AI hisob-kitobni faqat tahlil qiladi; pul amallari qo‘lda, ruxsat va bajarish chegarasi sinovdan o‘tdi
- [~] Bir martalik o‘quvchi/xodim ro‘yxati, avtomatik tanish va kirish/chiqish rejimi qo‘shildi; admin kamera/tugmalar tekshirildi. Haqiqiy shaxs, rozilik va USB kamera bilan ro‘yxat→tanish→qaydni to‘liq sinash kerak; surat bilan aldashga qarshi sertifikatlangan liveness yo‘q
- [x] AI moliya konteksti 4000 qator yuklash o‘rniga bitta jami natija oladi; yuz qidiruvi 300 ms kutadi, tanish parallel ishlamaydi. Mahalliy Face ID ochilishi 6.77–7.68 s; 100X tezlashish tasdiqlanmadi
- [x] 29 qoida sinovi va 9 mavjud dars sinovi o‘tdi; ekran xatosi yo‘q. To‘liq kamera/Telegram sinovi yuqoridagi tashqi shaxs harakatlarini kutadi

## Face ID — 2026-10-17
- [~] Ichki Face ID bugungi faol enrollment darsi davomatiga tranzaksiyada bog‘landi; takroriy va noaniq darslarda yangi davomat yozilmaydi, qo‘lda yozilgan belgilar saqlanadi; 15 qoida sinovi va admin ekran/kamera boshqaruvi tekshirildi. Bazada o‘quvchi yo‘q — haqiqiy o‘quvchi va USB kamera bilan to‘liq sinov kutilmoqda
- [~] Haqiqiy yuz solishtirish va old/o‘ng/chap avtomatik ro‘yxatga olish qo‘shildi; 6 qoida sinovi o‘tdi; haqiqiy o‘quvchi va USB kamera bilan aniqlik tekshiruvi kerak
- [x] OneID/MyID rasmiy imkoniyatlari tekshirildi; MyID biometrika, OneID kirish uchun; amaliy ulanish provayder shartnomasi, kirish ma’lumotlari va voyaga yetmaganlar talablari tasdig‘ini kutadi

- [x] Tizim nosozligi aniqlanganda ovozli signal (SystemAlertIndicator)
- [x] Kam ta'minlangan (reyestr) oila farzandlari guruh/ro'yxatlarda alohida belgi

## Professional daraja (Modme kabi) — dizayn o'zgarmaydi
### Moliya va to'lovlar
- [x] Har oy boshida avtomatik hisob (invoice) + avto chegirma
- [x] Qisman to'lov va oldindan to'lov balansi
- [x] Chegirmalarni to'lovda avtomatik qo'llash, qaytarish (refund) va to'lovni bekor qilish tarixi
- [x] Kassa yopilishi + o'qituvchi oyligi avtomatik hisoblanishi (cron 1-sana, qo'lda saqlanganlarni qayta yozmaydi)
### Guruh va jadval
- [ ] Guruh ichida darslar kalendari, xona/o'qituvchi to'qnashuvini tekshirish
- [ ] Bir bosishda guruh davomati, o'quvchini guruhdan guruhga ko'chirish
- [ ] O'qituvchi yuklamasi va bo'sh xonalar ko'rinishi
### Hisobot va analitika
- [ ] Direktor paneli: tushum, qarz, o'sish/ketish, guruh to'liqligi
- [ ] Oylik/fan/o'qituvchi bo'yicha hisobotlar va Excel eksport
### Yangi so'rovlar
- [x] CRM ichki dizayni barcha rollar uchun namuna palitrasida yangilandi; Ahmad direktor akkauntida katta/kichik ekran, grafik va menyu tekshirildi; ruxsat va oylik to‘lov sinovlari o‘tdi
- [~] Har bir o‘quvchining oylik to‘lovini alohida o‘zgartirish — qo‘shildi, 9 sinov o‘tdi; haqiqiy saqlashni tekshirish uchun preview’da admin/direktor kirishi kerak
- [x] Har qanday Excel: barcha varaqlar o'qiladi, fan varaq/fayl nomi yoki sarlavhadan aniqlanadi, guruh avtomatik ochiladi
- [x] Admin uchun bitta yagona boshqaruv paneli (AdminDesk — 12 ta tugma, tekshirildi)
- [~] Jarvis butun tizim ishini bajarishi va muammolarni hal qilishi (qarzdorlar, bugungi hisobot, to'lov qabul qilish, davomat qo'shildi; qolgan: to'liq avtonom hal qilish)
- [~] Direktorga 21:00 Jarvis hisoboti — cron tayyor, direktor botga /start yozishi kerak

## 2026-10-17 so'rovlar
- [x] Yangi login yaratish: zaif parol xabari o'zbekcha va forma ichida ko'rinadi; admin sessiyasida xavfsiz parol bilan login yaratildi, ro'yxatdan o'qildi va sinov akkaunti o'chirildi
- [x] Barcha eski ma'lumotlarni tozalash (akkauntlar saqlanadi)
- [x] Admin panel qidiruvi tuzatildi (guruh-o0027qituvchi bog0027lanishi xatosi edi)
- [x] Telefoniya (qo'ng'iroqlar) va chek chiqarishni olib tashlash
- [x] Admin ham Telegram (avvaldan qo0027llab-quvvatlangan, username orqali ulanadi) botdan foydalana olsin
- [ ] O'qituvchi balansi o'rniga Oylik katalogi: o'qituvchi/admin/oshpaz/farrosh
- [ ] Face ID: o'qituvchi 10 daqiqada kirmasa, o'quvchiga oylik yozilmasin

## 2026-10-20 tenant domen, logo, guruh
- [x] Markaz domeni (masalan ilmnuri.xyz) ochilganda o‘sha markaz nomi va kirish sahifasi chiqadi; CRM yon panelida foydalanuvchi markazi nomi.
- [x] EduNest logo/nomi tekshirildi: fayllar, sahifalar va bazada yo‘q; faqat Telegram eski preview keshi.
- [x] Guruhlar: bitta "O‘quvchi qo‘shish" tugmasi (guruh tanlanadi); global qidiruvdagi guruh shu guruhni ochadi.
- [x] ILM NURI direktor logini markazga biriktirildi (0023); admin logini hali yaratilmagan — Sozlamalar → Loginlar orqali.
- [x] ILM NURI: naqd/karta/bank kassalari yaratildi (0024); logo, manzil, fanlar markaz tomonidan o'zi to'ldiriladi.
- [x] Sozlamalarda "Markaz profili": nom, logo, telefon, manzil tahriri (updateMyCenter, rol + o'z markazi tekshiriladi).
- [x] O'quvchi profili: bitta "Guruhlarni boshqarish" oynasi — joriy guruhlar, chiqarish, almashtirish, yangi guruhga qo'shish.
- [ ] ilmnuri.xyz jonli trafikda qayta tekshirish (nashrdan keyin).
