# Akhmad Academy — Google Play va App Store uchun ilova

CRM veb-versiya sifatida `https://akhmadacademy.life` domenida ishlaydi. Mobil ilova
Capacitor wrapper orqali shu domenga ulanadi, shuning uchun tizim yangilanganda
ilova ham darhol yangilanadi (ilovani qayta yuklash shart emas).

## 1. Umumiy tayyorgarlik

```bash
bun add @capacitor/core @capacitor/android @capacitor/ios
bun add -d @capacitor/cli
export CAPACITOR_SERVER_URL=https://akhmadacademy.life
bun run build
```

- `appId`: `uz.akhmadacademy.crm` (bir marta e'lon qilingach o'zgarmaydi)
- `appName`: `Akhmad Academy`
- Ikonka: `public/logo.png` asosida 512×512 (Play) va 1024×1024 (App Store)

## 2. Android (Google Play)

Kerakli: Android Studio + Android SDK, JDK 17.

```bash
bunx cap add android
bunx cap sync android
bunx cap open android
```

Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle** →
`app-release.aab` faylini Play Console'ga yuklang.

Play Console uchun ro'yxat:
- 512×512 ikonka, 1024×500 feature grafika
- Kamida 2 ta telefon va 1 ta planshet skrinshoti
- Maxfiylik siyosati URL: `https://akhmadacademy.life/privacy`
- Data Safety: o'quvchi ismi, telefon, to'lov holati saqlanadi; faqat o'quv markaz
  boshqaruvi uchun ishlatiladi, uchinchi shaxsga sotilmaydi
- Content rating: Everyone / Ta'lim kategoriyasi

## 3. iOS (App Store)

Kerakli: macOS, Xcode 15+, Apple Developer akkaunt ($99/yil).

```bash
bunx cap add ios
bunx cap sync ios
bunx cap open ios
```

Xcode: Signing & Capabilities → Team tanlanadi → **Product → Archive** →
**Distribute App → App Store Connect**.

App Store Connect uchun ro'yxat:
- 1024×1024 ikonka (shaffof fon bo'lmasin)
- 6.7" va 5.5" iPhone skrinshotlari
- Maxfiylik siyosati URL va App Privacy anketasi
- Test akkaunt (login/parol) — Apple ko'rib chiqishi uchun **majburiy**
- Demo video yoki izoh: ilova o'quv markaz xodimlari uchun mo'ljallangan

⚠️ Apple faqat veb-saytni o'ravchi ilovalarni rad etishi mumkin (Guideline 4.2).
Shuning uchun ilovada native imkoniyatlar yoqilgan bo'lishi kerak:
push bildirishnoma, kamera (Face ID davomat), geolokatsiya (check-in) — bular
tizimda mavjud, ko'rib chiqish izohida shularni aniq yozing.

## 4. 20 markazga tarqatishda

Har markaz uchun alohida ilova chiqarish shart emas: bitta ilova ichida markaz
domeni sozlanadi yoki har markazga `appId` va `CAPACITOR_SERVER_URL` o'zgartirilib
alohida build qilinadi. Batafsil: `MULTI_CENTER.md`.

## Muhim xavfsizlik qoidasi

Telegram tokeni, cron siri va boshqa maxfiy qiymatlar faqat serverda saqlanadi —
mobil ilovaga yoki repozitoriyaga yozilmaydi.
