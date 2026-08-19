# CRM'ni boshqa o'quv markazlarga oylik abonent bilan sotish (SaaS)

Maqsad: bitta tizim ichida ko'p o'quv markaz (filial/tenant) ishlaydi, har biri faqat
o'z ma'lumotini ko'radi, siz esa egasi (super-admin) sifatida markazlarni qo'shasiz,
tarif belgilaysiz va oylik abonentni Payme/Click orqali qabul qilasiz. To'lov
kechiksa tizim markazni avtomatik cheklaydi.

## Nima qilinadi

### 1. Ko'p markaz (multi-tenant) asosi
- `centers` jadvali: nom, slug, logotip, telefon, manzil, holat (active / grace / suspended), tarif, o'quvchi limiti.
- Barcha asosiy jadvallarga markaz belgisi (`center_id`) qo'shiladi: students, groups,
  lessons, attendance, grades, behavior, payments, expenses, transactions, leads,
  cash_accounts, cash_shifts, rooms, subjects, settings, video_lessons va h.k.
- `user_centers` jadvali: har foydalanuvchi qaysi markazga tegishli.
- Yordamchi funksiyalar: `private.current_center()`, `private.in_center(uuid)`,
  `private.is_platform_owner()` — barcha RLS siyosatlari shu asosda yangilanadi.
- Mavjud ma'lumot bir "Akhmad Academy" markaziga ko'chiriladi (hech narsa yo'qolmaydi).
- Ro'yxatlar, hisobotlar, Jarvis, Telegram bot va cron ishlari avtomatik faqat
  o'z markazi bilan ishlaydi.

### 2. Abonent (billing) tizimi
- `plans` jadvali: tarif nomi, oylik narx, o'quvchi limiti, imkoniyatlar (Telegram bot,
  fiskal chek, Jarvis, IP telefoniya).
- `center_subscriptions`: markaz, tarif, boshlanish/tugash sanasi, holat.
- `center_invoices`: har oy uchun hisob-faktura (summa, muddat, to'langan/qarz).
- Har oy 1-kuni cron avtomatik hisob-faktura yaratadi va direktorga Telegram orqali yuboradi.
- Muddat: to'lov kunidan +5 kun "grace" (ogohlantirish banneri), keyin `suspended` —
  tizim faqat o'qish (read-only) rejimiga o'tadi, ma'lumot o'chirilmaydi.

### 3. Payme va Click integratsiyasi
- Har hisob-faktura uchun to'lov havolasi (Payme checkout / Click invoice) tayyorlanadi;
  direktor CRM ichida "To'lash" tugmasini bosadi yoki Telegramdagi havoladan to'laydi.
- Payme Merchant API (JSON-RPC: CheckPerformTransaction, CreateTransaction,
  PerformTransaction, CancelTransaction, CheckTransaction) uchun webhook.
- Click Shop API (Prepare / Complete) uchun webhook.
- To'lov tasdiqlansa: hisob-faktura "to'langan", abonent avtomatik +1 oyga uzayadi,
  cheklov olib tashlanadi, sizga va direktorga Telegram xabar boradi.

### 4. Egasi (super-admin) paneli — `/platform`
- Markazlar ro'yxati: holat, tarif, o'quvchi/o'qituvchi soni, oxirgi to'lov, qarz.
- Yangi markaz qo'shish ustasi: nom, brend, tarif, direktor login/parol, Telegram bot.
- Har markaz kartochkasi: abonentni uzaytirish, tarifni almashtirish, qo'lda to'lov
  kiritish, bloklash/ochish, faoliyat tarixi.
- Umumiy moliya: oylik tushum (MRR), qarzdor markazlar, to'lov tarixi.
- Faqat siz (platform owner) kirasiz — alohida rol, markaz direktorlariga ko'rinmaydi.

### 5. Direktor tomoni
- Sozlamalarda "Abonent" bo'limi: joriy tarif, keyingi to'lov sanasi, hisob-fakturalar,
  "Payme bilan to'lash" / "Click bilan to'lash" tugmalari, kvitansiya tarixi.
- To'lov muddati yaqinlashganda tizimda banner va Telegramda eslatma.

## Sizdan kerak bo'ladigan narsalar

Payme va Click integratsiyasi uchun merchant ma'lumotlari (keyinchalik xavfsiz
forma orqali kiritiladi):
- Payme: `PAYME_MERCHANT_ID`, `PAYME_KEY` (kassa kaliti)
- Click: `CLICK_MERCHANT_ID`, `CLICK_SERVICE_ID`, `CLICK_SECRET_KEY`

Kalitlar bo'lmasa ham tizim ishlaydi: hisob-faktura, muddat nazorati, qo'lda to'lov
kiritish va bloklash to'liq ishlaydi — faqat avtomatik onlayn to'lov o'chiq turadi.

## Bosqichlar (bosqichma-bosqich topshiriladi)

1. **1-bosqich (asos):** `centers`, `user_centers`, `center_id` migratsiyasi va RLS
   yangilanishi + mavjud ma'lumotni ko'chirish.
2. **2-bosqich (billing):** tariflar, abonent, hisob-faktura, cron va cheklov mantiqi.
3. **3-bosqich (panel):** `/platform` super-admin paneli va direktor "Abonent" bo'limi.
4. **4-bosqich (to'lov):** Payme va Click webhook'lari, to'lov havolalari, kvitansiya.

## Texnik tafsilotlar

- Migratsiyalar `supabase/migrations` orqali; har `CREATE TABLE` bilan birga `GRANT`
  va RLS siyosatlari yoziladi.
- RLS: `center_id = private.current_center()` yoki `private.is_platform_owner()`.
  `platform_owner` roli `app_role` enum'iga qo'shiladi.
- To'lov webhook'lari TanStack server route sifatida `src/routes/api/public/billing.payme.ts`
  va `billing.click.ts` — imzo/parol tekshiruvi handler ichida, javoblar Payme/Click
  protokoli formatida.
- Hisob-faktura generatori: `src/routes/api/public/cron.billing.ts` (CRON_SECRET bilan).
- Abonent holati bitta joyda hisoblanadi (`src/lib/billing.ts`) va UI/server bir xil
  qoidadan foydalanadi; cheklov server tomonda (RLS + server fn guard) qo'yiladi,
  faqat UI'da emas.
- Mavjud `branch_id` ustunlari (cash_register_settings) yangi `center_id` bilan
  moslashtiriladi.
