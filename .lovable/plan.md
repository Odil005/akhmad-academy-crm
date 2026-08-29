# O'qituvchini o'chirish va qo'shishni ishlaydigan qilish

## Muammo (kodda tekshirildi)

1. `/teachers` panelida o'chirish tugmasi umuman yo'q — o'qituvchini faqat Sozlamalar > Loginlar sahifasidan o'chirish mumkin.
2. O'chirish server funksiyasi (`deleteManagedUser`) faqat **direktor** rolini qabul qiladi; administrator bosganda "Faqat direktor o'chira oladi" javobi qaytadi.
3. O'chirish jarayonida oldingi bosqichlar (credentials, roles, profiles) xatolarini tekshirmaydi — faqat oxirgi `auth.admin.deleteUser` xatosi ko'rsatiladi. Bazada `created_by` tipidagi bir nechta bog'lanish (masalan `teacher_credentials.created_by`, `teacher_salary_payments.created_by`, `news.created_by`, `calls.created_by`, `settings.updated_by`) **NO ACTION** qilib qo'yilgan, ya'ni shu o'qituvchi biror yozuv yaratgan bo'lsa auth foydalanuvchini o'chirish FK xatosi bilan to'xtaydi va foydalanuvchi tushunarsiz xato ko'radi.

## Nima qilinadi

**1. `/teachers` paneliga o'chirish**
- Har bir o'qituvchi qatoriga "O'chirish" tugmasi (tasdiqlash oynasi bilan) qo'shiladi va `deleteManagedUser` chaqiriladi, muvaffaqiyatdan keyin ro'yxat yangilanadi.

**2. Ruxsat**
- `deleteManagedUser` administrator uchun ham ochiladi (direktorni o'chirish taqiqlangan holida qoladi) — bu `updateManagedLogin` bilan bir xil qoidaga keltiriladi.

**3. Ishonchli o'chirish**
- Server funksiyasi o'qituvchini o'chirishdan oldin bog'liq yozuvlarni bo'shatadi: `groups.teacher_id`, `lessons.teacher_user_id`, `student_enrollments.teacher_user_id` → NULL; `created_by`/`updated_by` NO ACTION bog'lanishlari NULL yoki o'chirgan xodimga o'tkaziladi.
- Har bir bosqich xatosi ushlanadi va aniq xabar qaytariladi ("Bu o'qituvchi ... yozuvlariga bog'langan"), shunda ko'r-ko'rona muvaffaqiyat ko'rsatilmaydi.
- Muqobil sifatida "arxivlash" (login o'chirish + roldan chiqarish, tarixiy yozuvlar saqlanadi) yo'li qo'llanadi, agar to'liq o'chirish moliyaviy tarixni buzsa.

**4. Qo'shishni tekshirish**
- `NewTeacherModal` orqali yaratish oqimi qayta sinovdan o'tkaziladi (profil + `teacher` roli + `teacher_credentials` + ro'yxatga chiqishi).

## GitLab haqida

Lovable faqat **GitHub** bilan bevosita sinxronlanadi — GitLab'ga to'g'ridan-to'g'ri ulanish yo'q. Agar GitLab kerak bo'lsa: GitHub repo asosiy bo'lib qoladi, GitLab'da esa "pull mirroring" (GitLab GitHub'dan avtomatik ko'chiradi) sozlanadi. Deploy muammosi GitLab'da ham yo'qolmaydi, chunki hozirgi nosozlik kod tarafida, repo platformasida emas.

## Texnik tafsilotlar

- Fayllar: `src/lib/user-admin.functions.ts` (ruxsat + bog'liqliklarni bo'shatish + xato xabarlari), `src/routes/_authenticated/teachers.tsx` (o'chirish tugmasi va holat), kerak bo'lsa `src/routes/_authenticated/settings.credentials.tsx` xato ko'rsatishini yaxshilash.
- Baza sxemasi o'zgarmaydi; barcha bog'lanishlarni bo'shatish server funksiyasi ichida `supabaseAdmin` bilan bajariladi.
