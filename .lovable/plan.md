# O'quv markazni CRM'ga o'rgatuvchi tizim

Maqsad: administrator, director, o'qituvchi va o'quvchi tizimni hech kim tushuntirmasa ham o'zi o'rganib olsin. Uch qism birgalikda ishlaydi.

## 1. Interaktiv tur (onboarding)

- Har bir rol uchun o'z qadamlari bo'lgan tur: kerakli tugma/bo'lim yorqin ajratiladi, yonida izoh oynasi va "Keyingi" tugmasi.
- Birinchi kirishda avtomatik ishga tushadi; keyin yuqori panelda "?" tugmasi orqali qayta ochiladi.
- Har bir rol uchun vazifalar ro'yxati (checklist): masalan administrator uchun "o'quvchi qo'shish", "to'lov qabul qilish", "davomat belgilash". Bajarilgani belgilanadi va progress foizda ko'rinadi.
- Tur qaysi qadamda to'xtagani saqlanadi — keyingi kirishda shu joydan davom etadi.

## 2. Jarvis o'rgatuvchi rejim

- Jarvis panelida yangi rejim: foydalanuvchi "Yangi o'quvchini qanday qo'shaman?" deb yozsa, javob qadamlar ro'yxati sifatida chiqadi va "Ko'rsatib ber" tugmasi bosilganda o'sha sahifa ochilib, interaktiv tur qadamlari ishga tushadi.
- Rolga qarab javob beradi — o'quvchiga moliya bo'limi haqida gapirmaydi.
- Tezkor savol chiplari: Davomat, To'lov, Hisobot, Dars jadvali.
- Har bir sahifada kontekstga bog'liq yordam: Jarvis ochilganda o'sha sahifa bo'yicha 3 ta taklif savol ko'rsatadi.

## 3. Video qo'llanma bo'limi

- Yangi sahifa: rol bo'yicha tablar (Administrator, Director, O'qituvchi, O'quvchi) va video kartochkalar (sarlavha, davomiylik, tavsif).
- Ko'rilgan videolar belgilanadi, progress hisoblanadi ("6 dan 4 tasi ko'rilgan").
- Videolarni director/administrator o'zi qo'shadi: sarlavha, rol, tartib, video havolasi yoki yuklangan fayl. Mavjud video darsliklar tizimidan foydalaniladi.
- Bo'limga o'quvchi va o'qituvchi menyusidan ham kirish mumkin.

## Texnik qism

- Yangi jadvallar: `onboarding_progress` (foydalanuvchi, rol, qadam, bajarilgan vazifalar) va `guide_videos` + `guide_video_views`. Har biriga RLS va GRANT: o'z yozuvini o'qish/yozish, video ro'yxatini barcha autentifikatsiyalangan foydalanuvchi o'qiydi, qo'shish faqat admin/director.
- Tur uchun engil o'z komponentimiz (`src/components/tour/*`): spotlight overlay + tooltip, `data-tour="..."` atributlari orqali elementlarni topadi. Qo'shimcha kutubxona o'rnatilmaydi (bundle o'smasin).
- Rol bo'yicha qadamlar ro'yxati alohida konfiguratsiya faylida (`src/lib/tour-steps.ts`) — keyin yangi qadam qo'shish oson.
- Jarvis tomonida: mavjud `src/lib/jarvis.functions.ts` ga `explain_feature` va `start_tour` tool'lari qo'shiladi; navigatsiya allaqachon bor mexanizmdan foydalanadi.
- Video sahifa lazy-load qilinadi, ro'yxat sahifalab yuklanadi — tizim tezligi pasaymaydi.
- Barcha matnlar o'zbek tilida, mavjud navy + gold dizayn tokenlari ishlatiladi.
