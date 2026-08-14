# Vercel'ga joylash

1. GitHub'ga loyihadagi barcha fayllarni yuklang. `.env` va `node_modules` ni yuklamang.
2. Vercel'da **Add New → Project** ni bosing va GitHub repository'ni import qiling.
3. **Environment Variables** ga `.env.example` dagi majburiy qiymatlarni kiriting. Qiymatlar eski lokal `.env` faylingizda bor.
4. Birinchi deploy uchun `APP_BASE_URL` ni vaqtincha bo'sh qoldiring yoki `https://your-project.vercel.app` yozing.
5. **Deploy** ni bosing. Vercel bergan haqiqiy domenni nusxalang, so'ng `APP_BASE_URL` ni shu domen bilan yangilang va **Redeploy** qiling.
6. Supabase **SQL Editor** orqali quyidagi yangi fayllarni ketma-ket bir marta ishga tushiring:
   - `supabase/migrations/20260811170000_performance_indexes.sql` — tizim tezligi uchun indekslar;
   - `supabase/migrations/20260811180000_video_lessons.sql` — yopiq video darslar;
   - `supabase/migrations/20260811190000_teacher_monthly_kpi.sql` — oylik KPI;
   - `supabase/migrations/20260811200000_teacher_commission_salary.sql` — administrator belgilaydigan foizli oylik, to'lov tarixi va oylik berilganini qayd qilish.

`SUPABASE_SERVICE_ROLE_KEY`, Telegram tokenlari va boshqa maxfiy qiymatlarni hech qachon GitHub'ga yuklamang; faqat Vercel Environment Variables bo'limiga kiriting.

## Arxitektura yangilanishlari

Yuqoridagi to'rtta fayldan keyin quyidagi migratsiyalarni ham ketma-ket ishga tushiring:

- `supabase/migrations/20260811210000_schedule_conflict_engine.sql` — bir xona, o'qituvchi yoki guruhga ustma-ust dars yozilishini bloklaydi;
- `supabase/migrations/20260811220000_video_access_hardening.sql` — video darslarni faqat tegishli o'qituvchi va faol o'quvchiga ochadi;
- `supabase/migrations/20260811230000_role_resilience.sql` — oxirgi direktor rolini tasodifan o'chirishni bloklaydi;
- `supabase/migrations/20260811240000_schedule_insights.sql` — jadvalning davomat va o'quvchi ko'rsatkichlarini tezlashtiradi.
- `supabase/migrations/20260811250000_disable_student_grades.sql` — o'quvchi baholarini tizimdan yopadi;
- `supabase/migrations/20260811260000_schedule_week_attendance.sql` — haftalik jadval davomat indikatorini tezlashtiradi;
- `supabase/migrations/20260812090000_telegram_bot_reliability.sql` — Telegram tokenlari, navbat va RLS himoyasini mustahkamlaydi;
- `supabase/migrations/20260812091000_remove_insecure_receipt_cron.sql` — eski hard-coded cron vazifasini o'chiradi.

Avvalgi migratsiyalar hali Supabase bazangizga kiritilmagan bo'lsa, loyiha ichidagi `supabase/migrations` fayllarini vaqt tartibida to'liq qo'llang. Faqat yangi fayllarni tanlab ishlatsangiz, yuqoridagi ro'yxat tartibini saqlang.

Eng oxirida `supabase/migrations/20260812100000_admin_desk_metrics.sql` faylini ham bir marta ishga tushiring. U administrator panelidagi faol o'quvchilar, shu oy to'laganlar va qarzdorlik raqamlarini tez va aniq hisoblaydi.

Telegram bot uchun undan keyin `supabase/migrations/20260814100000_telegram_bot_production.sql` faylini ishga tushiring. U dublikat webhooklarni bloklaydi, telefon bo'yicha ulanishni tezlashtiradi va o'quvchi Telegramini ota-ona Telegramidan ajratadi.

Jarvis va dars faolligi bo'yicha ota-ona xabarlari uchun oxirida `supabase/migrations/20260814110000_jarvis_parent_automation.sql` faylini ishga tushiring. Vercel Environment Variables bo'limida `LOVABLE_API_KEY` bo'lmasa Jarvisning AI savol-javob, ovoz va tool amallari ishlamaydi.

Jarvis orqali GitHub'da yangi funksiya vazifasi va avtomatik pull request yaratish uchun eng oxirida `supabase/migrations/20260814190000_jarvis_github_requests.sql` migratsiyasini ishga tushiring. Vercel Environment Variables ichida quyidagilarni kiriting:

- `GITHUB_JARVIS_TOKEN` — faqat shu repository uchun fine-grained token; Metadata read hamda Actions, Contents, Issues va Pull requests read/write;
- `GITHUB_JARVIS_REPOSITORY=Odil005/akhmad-academy-crm`;
- `GITHUB_JARVIS_BASE_BRANCH=main`;
- `GITHUB_JARVIS_AUTO_CODE=true` — pull requestni GitHub Copilot coding agent tayyorlashi uchun.

Bu imkoniyat faqat `admin` roliga ochiq. Jarvis issue/branch/pull request yaratadi, lekin `main` branchga avtomatik merge qilmaydi. GitHub Copilot coding agent uchun GitHub akkauntida pullik Copilot rejasi va repositoryda agent yoqilgan bo'lishi kerak.

## Deploydan keyingi majburiy tekshiruv

1. `/auth` orqali administrator hisobiga kiring.
2. Dashboardda **Administrator ish stolini ochish** tugmasini bosing.
3. To'rtta kartada `—` o'rniga haqiqiy raqamlar chiqqanini tekshiring.
4. Bitta test o'quvchiga pending to'lov yarating: qarzdorlar soni va jami qarzdorlik yangilanishi kerak.
5. To'lovni `paid` holatiga o'tkazing: qarzdorlik kamayishi va shu oy to'laganlar soni yangilanishi kerak.
6. `Sozlamalar → Tizim holati` bo'limida qizil xato qolmaganini tekshiring.
7. Telegram sozlangan bo'lsa, test xabar va webhook holatini tekshiring.
