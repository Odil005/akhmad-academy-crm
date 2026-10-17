# Tizim qotmasdan ishlashi

## Docker haqida
Sayt Lovable serverlarida ishlaydi va o'zi kengayadi. Bu yerda Docker ishlatib bo'lmaydi va unga ehtiyoj ham yo'q. Agar keyinchalik o'z serveringizga ko'chirmoqchi bo'lsangiz, kodni GitHub'ga chiqarib, Docker orqali o'zingiz joylashtirishingiz mumkin. Bu alohida ish, hozirgi rejaga kirmaydi.

## Nima qilinadi
1. **Tekshiruv (birinchi qadam):** sekin ishlayotgan baza so'rovlari, xatolar jurnali va eng og'ir sahifalar o'lchanadi: Bosh sahifa, O'quvchilar, To'lovlar, Davomat, Face ID va Jarvis. Qayerda qotishi aniq bo'lgandan keyingina tuzatiladi.
2. **Baza tezligi:** ko'p qidiriladigan maydonlarga indeks qo'shiladi: o'quvchi, guruh, to'lov holati, oy va sana bo'yicha.
3. **Katta ro'yxatlar:** O'quvchilar, To'lovlar, Qarzdorlar va Davomat sahifalarida ro'yxat sahifalarga bo'linib yuklanadi. Kerakli ma'lumotlar xotirada saqlanadi, shuning uchun har safar qaytadan yuklanmaydi.
4. **Face ID kiosk:** kamera kun bo'yi yoniq tursa ham kompyuter qizib ketmasligi uchun yuzni tanish tezligi cheklanadi. Internet uzilsa, kiosk o'zi qayta ulanadi. Kamera uzilsa, o'zi qayta ishga tushadi.
5. **Xatoga chidamlilik:** baza vaqtincha javob bermasa, sahifa qulamaydi. Qisqa xabar chiqadi va so'rov avtomatik qayta yuboriladi. Telegram bot va soat 21:00 hisoboti ham shu tartibda qayta urinadi.
6. **Yakuniy tekshiruv:** barcha testlar o'tkaziladi, asosiy sahifalar ochilish tezligi o'lchanadi, keyin publish qilish taklif qilinadi.

## Texnik tafsilotlar
- `supabase--slow_queries`, `db_health` va linter natijalari asosida indekslar migratsiya orqali qo'shiladi.
- Ro'yxatlar uchun server tomonda `range()` bilan sahifalash ishlatiladi. Ma'lumotlar `ensureQueryData` va `staleTime` bilan keshlanadi.
- Kiosk: tanish `requestAnimationFrame` o'rniga taxminan 2 soniyada bir marta ishlaydi; `track.onended` hodisasida kamera qayta ishga tushiriladi; `online`/`offline` hodisalari kuzatiladi.
- QueryClient'da qayta urinish va kutish vaqti `retry`/`backoff` bilan sozlanadi. Har bir route'da `errorComponent` bor-yo'qligi tekshiriladi.
