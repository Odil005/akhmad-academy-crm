# Nega ba'zi vazifalar bajarilmadi

Bazani hozir tekshirdim. Kod tomoni yozilgan, lekin ayrim modullar **tashqi tasdiq yoki sozlama ma'lumoti** yetishmagani uchun ishlamayapti:

```text
students 261    groups 8      subjects 9     teachers 14
lessons 1       payments 0    cash_accounts 0
director_report_recipients (aktiv) 0
sip_config 0    fiskal (enabled) 0
ota-ona telegram ulangan o'quvchi 0
```

## Sabablari (3 turga bo'linadi)

1. **Menda ruxsat yo'q (tashqi panel):** Cloudflare zona sozlamalari, Load Balancer/failover, ikkinchi origin server. Bularni faqat Cloudflare panelidan qilinadi — kod bilan yopilmaydi.
2. **Uchinchi tomon ma'lumoti berilmagan:** fiskal provayder (cashbox_id, TIN), SIP trunk (provayder, sip_uri, login). Shu sababli to'lov "mock" va `click-to-call` `not_configured` qaytaradi.
3. **Tizim ichida sozlama kiritilmagan:** kassa hisobi (0), direktor hisoboti oluvchisi (0), dars jadvali deyarli bo'sh (1 dars), ota-ona Telegram ulanmagan. Cron ishlaydi, lekin xabar boradigan manzil yo'q.

## Men hozir yopa oladigan qism (tasdiqdan keyin)

**A. Kassa va to'lov oqimini ishga tushirish**
- 3 ta kassa hisobi yaratish (Naqd / Karta / Bank).
- To'lov oynasida kassa yo'q bo'lsa ogohlantirish + shu yerdan yaratish.
- Fiskal o'chirilgan bo'lsa chekda "Fiskalsiz (test)" belgisi aniq ko'rinishi.

**B. Direktor kunlik hisoboti**
- Sozlamalarda direktor Telegram chat_id ni ulash va "Sinov xabarini yuborish" tugmasi.
- Aktiv oluvchi bo'lmasa Dashboardda ogohlantirish.

**C. Dars jadvalini to'ldirish**
- 8 guruh uchun jadval kiritish oynasi (guruh + fan + o'qituvchi + kun + vaqt), tez qo'shish uchun jadval ko'rinishida.

**D. Ota-ona Telegram onboardingi**
- O'quvchi kartasida "Ota-ona uchun havola" tugmasi (bir martalik token), ulangach avtomatik xabarlar boshlanadi.

**E. Setup checklist**
- `/settings/setup` da bajarilmagan qadamlar ro'yxati + foiz ko'rsatkich.

## Tasdiq kutadigan (men qila olmaydigan)
- Cloudflare: SSL Full Strict, Brotli, cache rules, LB pool + health probe (endpointlar tayyor: `/api/public/health/live`, `/ready`).
- Fiskal provayder va SIP trunk ma'lumotlari — siz bersangiz, o'sha kuni ulaymiz.

## Texnik izoh
Yangi jadval kerak emas; barchasi mavjud sxema (`cash_accounts`, `director_report_recipients`, `lessons`, `telegram_link_tokens`, `cash_register_settings`) ichida yopiladi.
