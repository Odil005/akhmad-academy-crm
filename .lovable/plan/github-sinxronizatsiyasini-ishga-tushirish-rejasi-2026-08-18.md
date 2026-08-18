# GitHub sinxronizatsiyasini ishga tushirish rejasi

## Muammo
Lovable'dagi kod o'zgarishlari GitHub repoga (`Odil005/akhmad-academy-crm`) tushmayapti. Natijada Vercel, Render va Cloudflare'da eski versiya qolmoqda.

Lovable ichki git holati:
- Oxirgi commit: `55e757f — Metodika va 20 markaz qo'shildi` (18-avgust 11:01 UTC)
- `main` branch mavjud va to'la kod bor
- Lovable ichki versiya nazorati ishlamoqda, lekin tashqi GitHub'ga push bo'lmayapti

## Yechim (foydalanuvchi tomonidan bajariladi)

Men GitHub sinxronizatsiyasini kod orqali ulay olmayman — bu Lovable interfeysida qo'l bilan amalga oshiriladi.

### 1-qadam: GitHub ulanishini tekshirish
- Lovable interfeysida yuqori o'ngdagi **GitHub** tugmasini bosing
- Agar "Connected" ko'rinmasa — ulanish to'liq tugamagan

### 2-qadam: To'liq ulash
- Plus (+) → **GitHub** → **Connect project**
- GitHub'da **Lovable GitHub App**'ni avtorizatsiya qiling
- To'g'ri GitHub akkauntni tanlang (Odil005)
- **Create Repository** yoki mavjud `Odil005/akhmad-academy-crm`'ni tanlang
- Jarayon to'liq tugaguncha kuting (repository yaratilishi bir necha soniya oladi)

### 3-qadam: Sinxronizatsiyani tekshirish
- Ulangach, GitHub repo'da `main` branch va oxirgi commit (`Metodika va 20 markaz qo'shildi`) paydo bo'lishi kerak
- Brauzerda https://github.com/Odil005/akhmad-academy-crm ochib tekshiring

### 4-qadam: Deploy targetlarni tekshirish
- **Vercel**: `main`'ga push bo'lishi bilan avtomatik deploy bo'ladi. Bo'lmasa: Deployments → Redeploy (cache o'chirib)
- **Render**: Manual Deploy → Clear build cache & deploy
- **Cloudflare**: `bun run build:cloudflare` + `bunx wrangler deploy` (avtomatik emas)

### 5-qadam: Sog'lig'ini tekshirish
- `GET /api/public/health/ready` → `200 {"status":"ready"}`
- 503 bo'lsa — o'sha serverning env'ida `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` yo'q

## Mening yordamim
Ulanish tugagach:
1. Yangi kod o'zgarishlari qilsam — ular avtomatik GitHub'ga tushishini tekshiraman
2. `.github/workflows/quality.yml` orqali CI testlar GitHub'da ishlashini ta'minlayman
3. Kerak bo'lsa, deploy config fayllarini (`vercel.json`, `wrangler.toml`) yangilayman
