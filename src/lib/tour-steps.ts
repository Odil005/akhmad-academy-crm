// Rol bo'yicha interaktiv tur qadamlari va vazifalar ro'yxati.
// Yangi qadam qo'shish uchun shu faylga bitta obyekt qo'shish yetarli.

export type TourStep = {
  /** data-tour="..." atributi qiymati. Bo'sh bo'lsa markazda ko'rsatiladi. */
  target?: string;
  title: string;
  body: string;
  /** Qadamga o'tishdan oldin shu sahifaga o'tiladi. */
  to?: string;
};

export type TourTask = {
  key: string;
  label: string;
  to: string;
};

export type TourRole = "admin" | "director" | "teacher" | "student";

const WELCOME: TourStep = {
  title: "Akhmad Academy CRM'ga xush kelibsiz",
  body: "Bu qisqa tur asosiy bo'limlarni ko'rsatadi. Har qadamda «Keyingi» tugmasini bosing, xohlagan paytda «Yopish» bilan to'xtatasiz.",
};

const JARVIS_STEP: TourStep = {
  target: "jarvis-button",
  title: "Jarvis — sizning yordamchingiz",
  body: "Biror amalni qanday qilishni bilmasangiz shu tugmani bosing va oddiy savol yozing: «Yangi o'quvchini qanday qo'shaman?». Jarvis qadamlarni tushuntiradi va kerakli sahifani o'zi ochib beradi.",
};

const GUIDE_STEP: TourStep = {
  target: "nav-/guide",
  title: "Video qo'llanma",
  body: "Har bir amal uchun qisqa video darslar shu bo'limda. Ko'rgan videolaringiz belgilanib boradi.",
  to: "/guide",
};

const HELP_STEP: TourStep = {
  target: "help-button",
  title: "Turni qayta ko'rish",
  body: "Shu «?» tugmasi orqali turni istalgan paytda qaytadan ishga tushirasiz.",
};

export const TOUR_STEPS: Record<TourRole, TourStep[]> = {
  admin: [
    WELCOME,
    {
      target: "nav-/dashboard",
      title: "Boshqaruv paneli",
      body: "Kunlik ko'rsatkichlar: o'quvchilar soni, bugungi to'lovlar, davomat foizi va so'nggi harakatlar.",
      to: "/dashboard",
    },
    {
      target: "nav-/students",
      title: "O'quvchilar",
      body: "O'quvchi qo'shish, tahrirlash, guruhga biriktirish va profilini to'liq ko'rish shu bo'limda.",
      to: "/students",
    },
    {
      target: "nav-/payments",
      title: "To'lovlar",
      body: "To'lov qabul qilasiz, fiskal chek chiqarasiz va to'lov tarixini ko'rasiz.",
      to: "/payments",
    },
    {
      target: "nav-/attendance",
      title: "Davomat",
      body: "Guruh va sana bo'yicha davomat belgilanadi. Kelmagan o'quvchining ota-onasiga xabar avtomatik ketadi.",
      to: "/attendance",
    },
    {
      target: "topbar-search",
      title: "Tezkor qidiruv",
      body: "O'quvchi ismi yoki telefon raqamining bir qismini yozsangiz ham topadi.",
    },
    JARVIS_STEP,
    GUIDE_STEP,
    HELP_STEP,
  ],
  director: [
    WELCOME,
    {
      target: "nav-/dashboard",
      title: "Boshqaruv paneli",
      body: "Markazning umumiy holati bir ekranda: o'quvchilar, tushum, davomat va ogohlantirishlar.",
      to: "/dashboard",
    },
    {
      target: "nav-/reports",
      title: "Hisobotlar",
      body: "Oylik va kunlik hisobotlar. Kunlik hisobot har kuni 20:00 da Telegramingizga avtomatik tushadi.",
      to: "/reports",
    },
    {
      target: "nav-/finance",
      title: "Moliya",
      body: "Daromad, xarajat, kassa harakati va foyda shu bo'limda hisoblanadi.",
      to: "/finance",
    },
    {
      target: "nav-/debtors",
      title: "Qarzdorlar",
      body: "To'lovi kechikkan o'quvchilar ro'yxati va ularga eslatma yuborish.",
      to: "/debtors",
    },
    {
      target: "nav-/settings",
      title: "Sozlamalar",
      body: "Login-parollar, Telegram ulanishi, fanlar, hisobot vaqti va boshqa sozlamalar.",
      to: "/settings",
    },
    JARVIS_STEP,
    GUIDE_STEP,
    HELP_STEP,
  ],
  teacher: [
    WELCOME,
    {
      target: "nav-/teacher-panel",
      title: "O'qituvchi paneli",
      body: "Guruhlaringiz, o'quvchilaringiz va bugungi darslaringiz shu yerda.",
      to: "/teacher-panel",
    },
    {
      target: "nav-/attendance",
      title: "Davomat belgilash",
      body: "Dars boshida guruhni tanlab davomatni belgilaysiz — bu KPI hisobiga ham ta'sir qiladi.",
      to: "/attendance",
    },
    {
      target: "nav-/behavior",
      title: "Dars faolligi",
      body: "Har bir o'quvchining darsdagi faolligini baholaysiz; ota-ona buni Telegramda ko'radi.",
      to: "/behavior",
    },
    {
      target: "nav-/video-lessons",
      title: "Video darslar",
      body: "Guruhingiz uchun video dars yuklaysiz, o'quvchilar uni ilovada ko'radi.",
      to: "/video-lessons",
    },
    {
      target: "nav-/teacher-kpi",
      title: "Oylik KPI",
      body: "Davomat, faollik va guruh natijalari bo'yicha oylik ko'rsatkichingiz.",
      to: "/teacher-kpi",
    },
    JARVIS_STEP,
    GUIDE_STEP,
    HELP_STEP,
  ],
  student: [
    WELCOME,
    {
      target: "nav-/schedule",
      title: "Dars jadvali",
      body: "Haftalik darslaringiz, vaqti va xonasi.",
      to: "/schedule",
    },
    {
      target: "nav-/video-lessons",
      title: "Video darslar",
      body: "O'qituvchingiz yuklagan video darslarni shu yerda ko'rasiz.",
      to: "/video-lessons",
    },
    {
      target: "nav-/knowledge-game",
      title: "Bilim o'yini",
      body: "Fanlar bo'yicha savol-javob o'yini — o'ynagan sari darajangiz oshadi.",
      to: "/knowledge-game",
    },
    {
      target: "nav-/roadmap",
      title: "Maqsad xaritasi",
      body: "Maqsad qo'yasiz va unga qanchalik yaqinlashganingizni kuzatasiz.",
      to: "/roadmap",
    },
    GUIDE_STEP,
    HELP_STEP,
  ],
};

export const TOUR_TASKS: Record<TourRole, TourTask[]> = {
  admin: [
    { key: "student", label: "Yangi o'quvchi qo'shish", to: "/students" },
    { key: "group", label: "Guruh yaratish", to: "/groups" },
    { key: "payment", label: "To'lov qabul qilish", to: "/payments" },
    { key: "attendance", label: "Davomat belgilash", to: "/attendance" },
    { key: "telegram", label: "Telegram ID ulash", to: "/settings/credentials" },
  ],
  director: [
    { key: "report", label: "Kunlik hisobotni ko'rish", to: "/reports" },
    { key: "finance", label: "Moliya bo'limini tekshirish", to: "/finance" },
    { key: "debtors", label: "Qarzdorlarni ko'rish", to: "/debtors" },
    { key: "credentials", label: "Login-parol yaratish", to: "/settings/credentials" },
    { key: "telegram", label: "Telegram hisobotni ulash", to: "/settings/director-report" },
  ],
  teacher: [
    { key: "attendance", label: "Davomat belgilash", to: "/attendance" },
    { key: "behavior", label: "Dars faolligini baholash", to: "/behavior" },
    { key: "video", label: "Video dars yuklash", to: "/video-lessons" },
    { key: "kpi", label: "KPI ni tekshirish", to: "/teacher-kpi" },
  ],
  student: [
    { key: "schedule", label: "Dars jadvalini ko'rish", to: "/schedule" },
    { key: "video", label: "Video darsni ko'rish", to: "/video-lessons" },
    { key: "game", label: "Bilim o'yinini o'ynash", to: "/knowledge-game" },
    { key: "roadmap", label: "Maqsad qo'yish", to: "/roadmap" },
  ],
};

export function resolveTourRole(roles: string[]): TourRole {
  if (roles.includes("director")) return "director";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("teacher")) return "teacher";
  return "student";
}
