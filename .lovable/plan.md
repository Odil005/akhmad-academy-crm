
# Tizimdagi kamchiliklar (tekshiruv natijasi)

Kodni va bazani tekshirdim. Funksional modullar yozilgan, lekin **tizim real ishga tushirilmagan** — asosiy kamchiliklar ma'lumot va sozlama darajasida.

## 1. Baza deyarli bo'sh (eng katta muammo)
Haqiqiy holat (bazadan o'qildi):

```text
subjects   0     students  0     lessons     0
groups     0     payments  0     attendance  0
cash_accounts 0  teacher/student credentials 0
user_roles 2 (1 director + 1 admin) — o'qituvchi yo'q
```

Natijada: Guruhlar, Dars jadvali, Davomat, Baholar, To'lovlar, Hisobotlar, Jarvis KPI — hammasi bo'sh ko'rinadi. Bu "xatolik" emas, ma'lumot yo'qligi.

## 2. Kassa (to'lov) ishlamaydi
- `cash_accounts` = 0 → to'lov qabul qilinganda pul qaysi kassaga tushishi yo'q.
- `cash_register_settings`: `enabled = false`, `provider_name = mock`, `cashbox_id` yo'q → fiskal chek **haqiqiy chiqmaydi**, faqat mock.

## 3. Direktor kunlik hisoboti hech kimga bormaydi
- Cron ishlayapti (`daily_director_report`, 20:00 Toshkent) ✅
- Lekin `director_report_recipients` = 0 → Telegram chat_id yo'q, xabar jo'natilmaydi.

## 4. Ota-ona Telegram oqimi bo'sh
- `parent_notifications` = 0, o'quvchi yo'q → bot bog'lanadigan bola yo'q.
- Har bir o'quvchida `parent_telegram_chat_id` to'ldirilishi kerak (bot orqali onboarding).

## 5. IP telefoniya (SIP) faqat "joy" holatida
- `sip_config` = 0 → `click-to-call` `not_configured` qaytaradi. Provayder ma'lumoti kiritilmagan.

## 6. Rollar to'liq emas
- Faqat director va admin bor. `teacher` va `student` roli hech kimda yo'q → O'qituvchi paneli, Teacher balans, Face-ID, O'quvchi kabineti sinovdan o'tmagan.

---

# Tavsiya qilinadigan reja (ishga tushirish paketi)

**Bosqich 1 — Boshlang'ich sozlash sehrgari (Setup Wizard)**
`/settings` ichida yangi "Tizimni ishga tushirish" sahifasi: bajarilmagan qadamlarni checklist qilib ko'rsatadi va har birini shu yerdan hal qiladi:
1. Kassa hisoblari (Naqd / Karta / Bank) yaratish
2. Fanlar qo'shish
3. O'qituvchilarni login bilan yaratish
4. Guruhlar + dars jadvali
5. O'quvchilarni qo'shish / Excel import
6. Direktor Telegram chat_id ni ulash
7. Virtual kassa (fiskal) yoqish
8. SIP trunk (ixtiyoriy)

Dashboardda esa qadamlar tugamaguncha "Tizim X% sozlangan" banneri chiqadi.

**Bosqich 2 — Bo'sh holat (empty state) sifatini oshirish**
Har bir bo'sh sahifada "Ma'lumot yo'q" o'rniga aniq harakat tugmasi: "Birinchi guruhni yarating", "Kassa hisobi qo'shing" va h.k.

**Bosqich 3 — To'lov modulini yopish**
- Kassa hisobi bo'lmasa to'lov oynasi ogohlantiradi va shu yerdan yaratishga ruxsat beradi.
- Fiskal `enabled=false` bo'lsa chekda "Fiskalsiz (mock)" belgisi aniq ko'rinadi.

**Bosqich 4 — Direktor va ota-ona kanalini tekshirish**
- Sozlamalarda "Sinov xabarini yuborish" tugmasi (direktor hisoboti va ota-ona bildirishnomasi uchun).

## Texnik izohlar
- Yangi jadval kerak emas; barcha kamchiliklar mavjud sxema ichida yopiladi.
- Setup checklist holati mavjud jadvallardagi `count` orqali hisoblanadi (qo'shimcha state saqlanmaydi).
- Cron va webhook'lar allaqachon to'g'ri, faqat qabul qiluvchi ma'lumot yetishmaydi.

Qaysi bosqichdan boshlaymiz — hammasini bittada qilaymi, yoki avval Setup Wizard + kassa qismini?
