## Reja — 3 qism: Yorug' mavzu + Moliya CRM + Qidiruv kartasi

### 1. Yorug' (oq) mavzu — oltin urg'u
`src/styles.css` da `:root` tokenlarini oq mavzuga o'tkazamiz. Hozirgi qora fon `.dark` klassiga ko'chadi (kelajakda toggle uchun tayyor turadi, default = light).

- `--background: #FFFFFF`, `--card: #FAFAF7`, `--foreground: oklch(0.18 0.01 60)` (deyarli qora matn)
- `--border: oklch(0.85 0.01 80)`, `--muted: #F4F4F0`, `--muted-foreground: oklch(0.45 0.01 60)`
- `--primary` oltin (hozirgi 0.86 0.17 92) qoladi, lekin `--primary-foreground` qora
- `glass`, `card-premium`, `gold-glow` utilitalar oq fon uchun qayta sozlanadi (soyalar yumshoq, orb'lar past opacity)
- Modal fon `bg-black/60` → `bg-black/40`, hard-coded `text-white` badge'lar (`status.ts`) oq matn qora badge'da qoladi (kontrast yaxshi)
- `PremiumBackground` va animatsion orb'lar rangi oltin/och kul rangga o'tadi
- Auth/landing sahifada matn kontrasti tekshirilib tuzatiladi

### 2. Moliyaviy CRM tizimi
Yangi 3 jadval + kengaytmalar:

**A. `cash_accounts`** — kassalar (Naqd, Karta, Bank, Payme va h.k.)
- `name`, `type` (cash/card/bank/online), `balance` (auto), `is_active`

**B. `transactions`** — barcha kirim-chiqim tarixi
- `type` enum: `income` / `expense`
- `category` (Ta'lim to'lovi, Marketplace, Ijara, Kommunal, Maosh, Marketing, Boshqa)
- `cash_account_id`, `amount`, `description`, `student_id?`, `payment_id?`, `expense_id?`
- `created_by`, `occurred_at`
- Trigger: har `payments` (status=paid) va `marketplace_orders` (paid) avtomatik `transactions` (income) yaratadi
- Trigger: `cash_accounts.balance` avtomatik yangilanadi

**C. `expenses`** — chiqimlar reestri
- `category`, `amount`, `paid_at`, `description`, `cash_account_id`, `receipt_url?`, `recurring` (monthly/one-time)
- Trigger: `expense` yaratilganda `transactions` (expense) qo'shiladi

**D. `payments` kengaytma**
- `method` enum: cash/card/bank/payme/click (allaqachon `payment_method` bor — tekshiramiz)
- `cash_account_id` FK qo'shiladi
- `next_due_date` — avtomatik keyingi to'lov sanasi (rasmda "Keyingi to'lov 2026-08-01")

**E. `teacher_salary_payments`** — allaqachon bor, `cash_account_id` bilan bog'lanadi va `transactions` (expense) trigger qo'shamiz.

**Yangi sahifalar:**
- `/finance` — dashboard: bugungi kassa balansi, oylik P&L, kirim vs chiqim grafik, oxirgi 20 tranzaksiya
- `/finance/transactions` — filtr bo'yicha (sana, kassa, kategoriya, tur), CSV eksport
- `/finance/expenses` — chiqim qo'shish/tahrir/o'chirish, kategoriya bo'yicha statistika
- `/finance/cash-accounts` — kassalar boshqaruvi (director)
- `/finance/report` — oylik/yillik hisobot (kirim, chiqim, foyda, o'qituvchi maoshi, marketplace tushumi)

**RLS:** director hammasini ko'radi/tahrirlaydi. Admin — o'qiydi + tranzaksiya qo'shadi. Teacher/Student — ko'ra olmaydi.

Sidebar'ga "💰 Moliya" bo'limi (director+admin) qo'shiladi.

### 3. Qidiruv kartasi — to'liq ma'lumot bilan
`src/routes/_authenticated/search.tsx` da o'quvchi kartasi kengaytiriladi (rasmdagi profilga o'xshash mini-versiya):

Har o'quvchi kartasi ichida:
- **Chap taraf:** ism, status badge (o'zgartirish uchun dropdown — "Boshqa guruhga o'tkazish"), telefon, ota-ona F.I.O + telefoni + Telegram (agar bor bo'lsa)
- **O'ng taraf (guruh(lar) bo'yicha):** har `student_enrollments` qatori uchun:
  - Fan · Guruh nomi · O'qituvchi F.I.O
  - Dars kunlari (Dush/Chor/Juma) va vaqti
  - Keyingi to'lov sanasi + summasi
  - Joriy qarz (qizil) yoki oldindan to'langan (yashil)
- **Tez amallar:** "Profilga o'tish", "To'lov qilish" (modal), "Boshqa guruhga o'tkazish" (enrollment select)
- Ma'lumot `students` + `student_enrollments` + `groups` + `subjects` + `profiles` (teacher) + `lessons` (dars kunlari uchun) + `payments`(next_due) — bitta batched query bilan (N+1 dan qochish)

Loading uchun `skeleton` utiliti ishlatiladi. Kartalar `card-premium` uslubida.

---

### Bosqichlar
1. **Migration** — cash_accounts, transactions, expenses, triggers, RLS, GRANTs, `payments.next_due_date` + `cash_account_id`
2. **Light theme** — `src/styles.css` tokenlarini oq'ga o'tkazish, animatsion fon rangini moslashtirish
3. **Moliya UI** — 5 ta yangi route + sidebar link
4. **Qidiruv kartasi** — batched fetcher + kengaytirilgan JSX

Har bosqich tugagach preview'da tekshiramiz. Boshqa modullar (davomat, guruhlar) tegilmaydi — faqat matn/border ranglari yorug' mavzuga moslashadi (semantik tokenlar orqali avtomatik).
