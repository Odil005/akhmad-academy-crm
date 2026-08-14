# Play Market uchun Android ilova

UNICRM internetdagi Vercel versiyasiga ulanadigan Android ilova sifatida chiqariladi. Bu usulda tizimning yangi versiyasi Vercel'da yangilanganda ilova ham yangilangan ma'lumotlarni ishlatadi.

## Bir marta tayyorlash

1. Vercel deploy tugasin va haqiqiy domenni oling: masalan `https://unicrm.vercel.app`.
2. Kompyuterga Android Studio (Android SDK bilan), JDK 17 va Bun o'rnating.
3. Loyiha papkasida quyidagi buyruqlarni bering:

```bash
bun add @capacitor/core @capacitor/android
bun add -d @capacitor/cli
set CAPACITOR_SERVER_URL=https://sizning-domeningiz.vercel.app
bunx cap add android
bunx cap sync android
bunx cap open android
```

4. Android Studio ichida **Build → Generate Signed Bundle / APK → Android App Bundle** ni tanlang.
5. `app-release.aab` faylini Play Console'ga yuklang.

## Play Console uchun kerak bo'ladiganlar

- Ilova nomi: UNICRM Academy
- Paket nomi: `uz.unicrm.academy` (bir marta e'lon qilingach o'zgarmaydi)
- 512×512 ikonka, kamida 2 ta telefon skrinshoti
- Maxfiylik siyosati URL'i
- Data Safety formasi: CRM o'quvchi ma'lumotlarini saqlashi va nima uchun ishlatishini aniq ko'rsating

## Muhim

- `SUPABASE_SERVICE_ROLE_KEY`, Telegram tokenlari va boshqa sirlarni Android ilovaga yoki GitHub'ga yozmang.
- Google Play'ga yuborishdan oldin login, video dars, Telegram va o'quvchi ruxsatlarini real test akkauntlar bilan sinang.
