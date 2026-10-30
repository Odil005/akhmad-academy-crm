# Bitta joyda jamlangan o'quvchi profili

## Natija
O'quvchining ism-familiyasi bosilgan har bir joydan (O'quvchilar ro'yxati, Guruh tarkibi, Davomat, To'lovlar, Qarzdorlar, qidiruv, o'qituvchi profili) bitta profil sahifasi ochiladi. Hammasi shu sahifada:

- **Sarlavha:** rasm (Face ID rasmi), ism, holat, telefon, ota-ona telefoni; tugmalar: "To'lov qabul qilish", "Guruhlarni boshqarish", "Tahrirlash".
- **4 ta ko'rsatkich:** balans/qarz, oylik davomat %, guruhlar soni, oxirgi to'lov.
- **Bo'limlar:** Umumiy, Guruhlar, Davomat, To'lovlar, Baholar, Face ID.
  - Guruhlar: joriy guruhlar, kunlari va vaqti, "Almashtirish", "Chiqarish", "Guruh qo'shish", oylikni o'zgartirish.
  - Davomat: oylik kalendar (keldi / kelmadi / noma'lum), oylar bo'yicha o'tish.
  - To'lovlar: barcha hisoblar va to'lovlar, holati; shu yerdan to'lov qabul qilish.
  - Baholar va xulq, Face ID holati va ruxsatlar.
- Eski to'lovlar va davomat o'zgarmaydi; guruh almashtirilsa eski tarix saqlanadi.

## Bosqichlar
1. Barcha ro'yxatlardagi o'quvchi ismini profilga havola qilish.
2. Profil sarlavhasi va 4 ko'rsatkichni qo'shish.
3. Mavjud ma'lumotlarni bo'limlarga ajratish (Guruhlar, Davomat kalendari, To'lovlar, Baholar, Face ID).
4. Mavjud "Guruhlarni boshqarish" oynasi va to'lov oynasini profilga ulash.
5. Telefon o'lchamida ham qulay ko'rinishi; administrator hisobidan sinash.

## Texnik tafsilotlar
- Mavjud `students.$id.tsx` va `GroupManageModal`, `PaymentModal`, `StudentFeeEditor` qayta ishlatiladi; yangi jadval kerak emas.
- Tablar URL qidiruv parametri (`?tab=`) orqali, har tab ma'lumoti faqat ochilganda yuklanadi (tezlik uchun).
- Havolalar: groups, attendance, payments, debtors, teachers_.$id, GlobalSearch.
