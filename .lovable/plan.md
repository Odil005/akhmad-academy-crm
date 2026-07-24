# Reja: EduNest rasmlarni olib tashlash + rasmdagi ko'k/qizil/yashil dizayn

Rasm asosida: yuqori nav ko'k urg'uli oq fon, aktiv menyu ko'k plyonka, tugmalar ko'k, ogohlantirish/qarzdorlik qizil, muvaffaqiyat yashil, darslar taqvimi qizil kvadratchalar.

## 1) EduNest bino rasmlarini olib tashlash
- `src/routes/index.tsx` hero'dan `edunest-hero`/`edunest-building` rasmlarini olib tashlash. O'ng ustunga Akhmad Academy logotipi va qisqa mazmun kartasi qo'yiladi (bo'sh joy qolmasin).
- `src/components/MediaCarousels.tsx` bosh sahifadan chiqariladi.
- Foydalanilmagan asset pointerlar `src/assets/edunest-hero.png.asset.json` va `src/assets/edunest-building.png.asset.json` `lovable-assets delete` bilan o'chiriladi.

## 2) Yangi rang tizimi — ko'k + qizil + yashil (rasmdagi kabi)
`src/styles.css` yangilanadi (light va dark ikkalasi):

- `--primary` = ko'k `oklch(0.55 0.20 260)` (nav aktiv, asosiy tugma "Guruhga qo'shish", TO'LOV chip)
- `--accent` = yashil `oklch(0.62 0.17 150)` (muvaffaqiyat, "To'langan" legendasi, faol status nuqtasi)
- `--destructive` = qizil `oklch(0.60 0.22 25)` (qarzdorlik chip, "Pul qaytarish", "Baho: 0.00" pill, taqvim qizil kunlari)
- `--background` = deyarli oq `oklch(0.99 0.005 250)`; `--card` = oq; `--foreground` = to'q kulrang
- `--border`/`--input` yumshoq ko'k-kulrang; `--ring` ko'k
- `.gold-text` yordamchisi ko'k-yashil gradient matnga aylantiriladi

## 3) Yuqori navigatsiya rasmdagi ko'rinishga o'tkaziladi
`src/routes/_authenticated/route.tsx`:
- Fon `glass-strong` (qora shisha) o'rniga oq/deyarli oq, past soya bilan
- Aktiv menyu — ko'k urg'uli plyonka + ko'k matn (yoki ko'k fon + oq matn), passiv menyu neytral kulrang
- Yuqori o'ng burchakda ko'k "TO'LOV" tugmasi (yorliq: To'lov qilish, `/payments`ga olib boradi)
- Logotip yonida "Akhmad Academy" matni to'q, `gold-text` o'rniga ko'k gradient

## 4) O'quvchi profili sahifasi (`students.$id.tsx`)
Rasm bilan aynan mos kelishi uchun:
- Chap kartada "Baho: 0.00" qizil kontur pill, ID qora, telefon oddiy
- "Guruhga qo'shish" — ko'k to'liq tugma, "To'lov qilish" — ko'k kontur, "Pul qaytarish" — qizil kontur
- O'ng karta sarlavhasi ko'k plyonka: chapda yashil doira + `-250 000 so'm`, o'ngda "Faol" tanlagichi (dropdown chevron)
- Karta ichi oq; "Baho: 0.00" qizil kontur pill; Dars kunlari uchun kulrang yumshoq chiplar
- Darslar taqvimida dars kunlari qizil kvadratchalar, tanlangan sana ko'k ramkali; legenda: yashil "To'langan", qizil "Qarzdor", kulrang "Kutilayotgan"

## 5) Ambient fon
`src/components/AmbientBackground.tsx` va `src/styles.css` keyframe'lari:
- Orblar: bittasi ko'k, bittasi yashil, bittasi qizil — juda past opacity (0.10–0.14), katta blur — oq fon ustida yumshoq ko'rinadi
- Grain va vignette engillashtiriladi (light rejim uchun); konik shimmer opacity kamaytiriladi

## Ta'sir qilinadigan fayllar
- `src/routes/index.tsx` — rasm olib tashlanadi, hero qayta muvozanatlanadi
- `src/components/MediaCarousels.tsx` chaqirig'i olib tashlanadi (fayl saqlanadi)
- `src/styles.css` — butun palitra qayta yoziladi, keyframe rang qiymatlari yangilanadi, `.gold-text` gradienti almashtiriladi
- `src/components/AmbientBackground.tsx` — orb ranglari
- `src/routes/_authenticated/route.tsx` — top nav uslubi (oq fon, ko'k aktiv, TO'LOV tugmasi)
- `src/routes/_authenticated/students.$id.tsx` — chip/tugma ranglari, karta sarlavhasi ko'k, taqvim qizil kunlari va legenda
- `src/assets/edunest-hero.png.asset.json`, `src/assets/edunest-building.png.asset.json` — `lovable-assets delete` orqali o'chiriladi

Logotip o'zgarmaydi (Akhmad Academy navy+gold aylanma logo hamma joyda qoladi), atrofidagi UI faqat ko'k/qizil/yashil palitraga o'tadi.
