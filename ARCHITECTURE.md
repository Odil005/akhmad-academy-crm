# UNICRM arxitekturasi

Bu tizim o'quv markazining kundalik ishini tez va tartibli olib borish uchun qatlamlarga ajratilgan.

## Ishlash tartibi

```text
Panel (Director / Admin / O'qituvchi / O'quvchi)
        ↓
Route va feature modullari
        ↓
Server amallari va yagona ruxsat qoidalari
        ↓
Supabase RLS, migratsiyalar va ma'lumotlar bazasi
```

## Muhim qoidalar

- `lessons` yagona haqiqiy dars jadvali hisoblanadi. Guruhdagi oddiy jadval matni faqat izoh bo'lib qoladi.
- Jadvalda bitta xona, o'qituvchi yoki guruh bir vaqtda ikki darsga tushmaydi. Tekshiruv ham ekranda, ham bazada ishlaydi.
- Jadval ochilganda asosiy doska birinchi chiqadi. Davomat va o'quvchi soni jamlanma ko'rinishida alohida, tezkor so'rov bilan keladi.
- Admin faqat o'quvchi va o'qituvchi loginlarini yaratadi yoki kodini almashtiradi. Director admin va director hisoblarini boshqaradi.
- Oxirgi director roli o'chirilmaydi.
- Video darsni faqat guruhga biriktirilgan o'qituvchi yuklay oladi. O'quvchi faqat faol guruhi uchun chiqarilgan videoni ko'radi.
- O'qituvchi oyligi to'lovdagi tarixiy o'qituvchi belgisi bo'yicha hisoblanadi. Guruh o'qituvchisi keyin almashsa, oldingi oylar buzilmaydi.

## Keyingi kengaytirishlar

Keyingi bosqichlarda davomatni to'liq `student_enrollments` asosiga o'tkazish, oylikni serverda tasdiqlanadigan snapshotga aylantirish va Click/Payme kabi to'lov provayderlarini alohida server integratsiyasi sifatida ulash tavsiya qilinadi.
