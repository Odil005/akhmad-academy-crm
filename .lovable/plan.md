
# Akhmad Academy — To'liq avtomatlashtirish

Tizim bitta o'quv markaz uchun optimallashtiriladi. Uchta yirik blok bir migratsiya + kod paketi bilan yakunlanadi.

## 1) Kunlik direktor hisoboti (avtomatik)

**Ma'lumotlar bazasi**
- `director_daily_reports` jadval: `report_date`, `revenue`, `expenses`, `profit`, `new_leads`, `new_students`, `attendance_rate`, `debtors_count`, `debtors_amount`, `top_teachers` jsonb, `payload` jsonb, `sent_at`, `telegram_message_id`.
- `director_report_recipients` jadval: `user_id`, `telegram_chat_id`, `is_active` — direktor(lar) uchun chat_id ro'yxati.
- RLS: faqat director/admin roli o'qiy oladi; yozishni service_role qiladi.

**Server route (cron target)**
- `src/routes/api/public/cron.daily-report.ts` — har kuni 21:00 (Asia/Tashkent) da chaqiriladi.
- Kecha bo'yicha to'lov, xarajat, davomat, yangi lid/o'quvchi statistikasini yig'adi.
- Jarvis (Gemini) orqali qisqacha uzbek tilida sharh yozadi (top-o'qituvchi, qarzdorlar ro'yxati, kunlik xulosa).
- Har direktorga Telegram orqali batafsil xabar + tugmalar ("To'liq hisobot", "Qarzdorlar", "Lidlar") jo'natadi.

**pg_cron**
- `daily_director_report_21` — `0 16 * * *` (UTC = 21:00 Toshkent), `apikey` header + anon key bilan chaqiradi.

## 2) Ota-ona ↔ Jarvis (Telegram) to'liq avtomatlashtirish

**Onboarding kuchaytiriladi**
- Mavjud telegram webhook'ga davom: ota-ona ism+familiya+tel raqamini kiritganda avtomatik `students` bilan bog'lanadi.
- `parent_chat_links` mavjud (parent_telegram_chat_id ustunlari orqali). Yangi bo'lsa — `parent_link_tokens`ni admin panelidan yaratmasdan ham telefon orqali topish ishlaydi (allaqachon mavjud, kengaytiriladi).

**Kunlik avtomatik xabarlar (ota-onaga)**
- `src/routes/api/public/cron.parent-digest.ts` har kuni 20:00 da:
  - Bugungi davomat holati (bor / yo'q / kech qoldi)
  - Bugungi baho(lar)
  - Xulq bahosi (agar bugungi bo'lsa)
  - To'lov qolgani va muddati (7 kun / 3 kun / kech ogohlantirishlar bilan)
- Har bir xabar `parent_notifications`ga yoziladi (deduplikatsiya uchun `kind + date` unique index).

**Trigger-based real vaqt xabarlar**
- Yangi `payment` qo'shilganda / `paid` bo'lganda → trigger `parent_notifications`ga qatorlar qo'yadi.
- Yangi `grade` / `behavior_evaluation` / `attendance` (absent) → trigger.
- Har 5 daqiqada `cron.notifications-dispatch.ts` `pending` yozuvlarni Telegramga jo'natadi.

**Jarvis suhbat (ota-ona)**
- Telegram webhook: ota-ona xabari erkin matnda kelsa (menyu tugmalari o'rniga) — Gemini AI o'sha bolaning kontekstini (guruh, o'qituvchilar, so'nggi baho/davomat/to'lov) berib javob beradi.
- Menyu tugmalari saqlanadi: "📊 Hozirgi holat", "💰 To'lov", "📅 Bugungi dars", "✍️ O'qituvchiga xabar", "🤖 Jarvis'ga so'rov".

## 3) SIP Trunk / IP telefoniya uchun tayyor joy

**Ma'lumotlar bazasi**
- `sip_config` jadval (singleton): `provider` (masalan `beeline`, `uztelecom`, `mango`, `custom`), `sip_uri`, `username`, `auth_id`, `caller_id`, `webhook_secret`, `is_active`, `notes`.
- `sip_extensions` jadval: xodim → ichki raqam ma'lumoti.
- `calls` jadvali mavjud — kengaytiramiz: `sip_call_id`, `trunk`, `answered_at`, `hangup_cause`, `cost`, `recording_storage_path`.

**Server routes**
- `src/routes/api/public/telephony.sip-webhook.ts` — SIP provayder eventlari (`ringing`, `answered`, `hangup`, `recording_ready`) uchun HMAC-signed endpoint.
- `src/routes/api/public/telephony.click-to-call.ts` — CRM ichidan qo'ng'iroq boshlash (autentifikatsiyalangan). Hozircha stub: `sip_config.is_active` bo'lsa provayder API'siga POST, aks holda `not_configured` qaytaradi.
- Mavjud `telephony.outbox.ts` va `telephony.webhook.ts` shu doiraga moslashtiriladi.

**Sozlamalar UI**
- `src/routes/_authenticated/settings.telephony.tsx` — SIP config formasi (direktor uchun): trunk parametrlari, ichki raqamlar, webhook URL ko'rsatiladi. Test tugmasi.

## 4) Umumiy

- Yagona migratsiya: barcha jadvallar, GRANT'lar, RLS, triggerlar, indekslar.
- pg_cron ikkita yangi ish: kunlik direktor hisoboti va ota-ona digest + har 5 daq notif-dispatch.
- Nav'ga qo'shiladi: **Sozlamalar → Telefoniya**, **Sozlamalar → Direktor hisoboti (qabul qiluvchilar)**.
- Barcha AI chaqiruvlari `google/gemini-2.5-flash` orqali Lovable AI Gateway'da.

## Texnik izohlar

- Cron endpointlar `/api/public/*` — anon key `apikey` header bilan.
- Telegram jo'natish `sendMessage` va `parse_mode: HTML`.
- SIP provider sirlar `add_secret` orqali (keyingi bosqichda user o'zi kiritadi) — kod hozirdan `process.env.SIP_*` o'qishga tayyor.
- Ota-ona real-time notif triggerlari `payments`, `grades`, `behavior_evaluations`, `attendance` jadvallariga qo'shiladi (idempotent — INSERT yoki status o'zgarganda).

Tayyor bo'lsa, "ha" desangiz — bitta migratsiya + fayllar to'plamini yozaman.
