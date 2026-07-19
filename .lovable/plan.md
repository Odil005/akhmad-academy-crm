## Muammo

Bosh sahifa "qotib qotib" ishlayapti, chunki bir nechta muhim tarmoq so'rovlari **401 xatolik** bilan qaytmoqda va React Query ularni doimiy qayta yuboryapti (asosiy oqim shu bilan bo'g'ilib qolyapti).

Tarmoq loglaridan:
```
GET .../homepage_courses?... → 401
{"code":"42501","message":"permission denied for function has_role"}
```

### Asosiy sabab

Oldingi xavfsizlik tuzatishida `public.has_role(uuid, app_role)` funksiyasidan `EXECUTE` huquqi `anon` roli uchun **olib tashlangan**.

Ammo `homepage_courses`, `homepage_sections`, `design_settings` jadvallarining ochiq o'qish siyosatlari `has_role()` ni ichida chaqiradi:

```
(is_visible OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'admin'))
```

Anonim tashrifchi (kirmagan foydalanuvchi) uchun Postgres siyosatni tekshira olmaydi → **42501 permission denied** → 401 qaytadi → TanStack Query eksponensial retry qiladi → sayt qotib qoladi.

### Ikkinchi sabab (kichik)

Global ambient fon (`blur(60px)` × 2 katta orb) + har bir bo'limdagi `backdrop-blur-sm` bir vaqtda ishlaganda past quvvatli qurilmalarda paint jank keltiradi.

## Yechim

### 1. RLS ijro huquqini tiklash (asosiy fix)

Yangi migratsiya:
```sql
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;
```

Bu xavfsiz — `has_role` `SECURITY DEFINER`, ichida faqat `user_roles` dan `SELECT` qiladi va `auth.uid()` `null` bo'lsa `false` qaytaradi. Anonim foydalanuvchi hech qanday yangi ma'lumot ko'rmaydi, faqat ochiq o'qish siyosatlari to'g'ri ishlaydi.

Natija: `homepage_courses` va boshqa ochiq jadvallar 200 qaytaradi, sayt sekinlashuvi yo'qoladi.

### 2. Paint jank kamaytirish

`src/routes/index.tsx` da bo'limlardan `backdrop-blur-sm` ni olib tashlash — ambient fon allaqachon yumshoq, qo'sh blur kerak emas:

```
bg-background/40 backdrop-blur-sm py-20 cv-auto  →  bg-background/70 py-20 cv-auto
bg-secondary/20 backdrop-blur-sm py-20 cv-auto   →  bg-secondary/40 py-20 cv-auto
bg-background/60 backdrop-blur-sm py-10          →  bg-background/80 py-10
```

`src/styles.css` da ambient orb bluri `60px → 40px`, bu GPU kompozitsiyani tezlashtiradi.

## Tekshirish

1. Migratsiyadan keyin brauzerda tarmoq panelida `homepage_courses` so'rovi **200** qaytishini tasdiqlash.
2. Sahifa scrolli silliq bo'lishini vizual tekshirish.
