# Roadmap

## Face ID — 2026-10-17
- [ ] Ichki Face ID tasdig‘ini o‘quvchining bugungi guruh darsi davomatiga aniq, takrorsiz bog‘lash
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
