// Jarvis o'rgatuvchi rejimi uchun bilim bazasi: "qanday qilaman?" savollariga
// bir zumda (AI'ga bormasdan) qadamli javob qaytaradi.

export type HowTo = {
  key: string;
  title: string;
  steps: string[];
  /** "Ko'rsatib ber" bosilganda ochiladigan sahifa. */
  to: string;
  /** Tur qadami uchun data-tour nishoni (bo'lsa tur ham ishga tushadi). */
  tourTarget?: string;
  roles: Array<"admin" | "director" | "teacher" | "student">;
  keywords: string[];
};

export const HOW_TOS: HowTo[] = [
  {
    key: "add-student",
    title: "Yangi o'quvchi qo'shish",
    steps: [
      "Chap menyudan «O'quvchilar» bo'limiga o'ting.",
      "Yuqoridagi «Yangi o'quvchi» tugmasini bosing.",
      "Ism, familiya, telefon raqami va tug'ilgan sanani kiriting.",
      "Guruhni tanlang va saqlang — login-parol shu yerda avtomatik yaratiladi.",
    ],
    to: "/students",
    tourTarget: "nav-/students",
    roles: ["admin", "director"],
    keywords: ["o'quvchi qo'sh", "oquvchi qosh", "yangi o'quvchi", "yangi oquvchi", "talaba qosh"],
  },
  {
    key: "add-teacher",
    title: "Yangi o'qituvchi qo'shish",
    steps: [
      "«O'qituvchilar ro'yxati» bo'limiga o'ting.",
      "«Yangi o'qituvchi» tugmasini bosing.",
      "Ism-familiya, telefon, fan va rasmini yuklang.",
      "Saqlaganda login-parol avtomatik yaratiladi va ro'yxatga tushadi.",
    ],
    to: "/teachers",
    tourTarget: "nav-/teachers",
    roles: ["admin", "director"],
    keywords: ["o'qituvchi qo'sh", "oqituvchi qosh", "yangi o'qituvchi", "ustoz qosh"],
  },
  {
    key: "payment",
    title: "To'lov qabul qilish va chek chiqarish",
    steps: [
      "«To'lovlar» bo'limiga o'ting.",
      "«To'lov qabul qilish» tugmasini bosing va o'quvchini tanlang.",
      "Summani, to'lov turini (naqd/karta) va oyni belgilang.",
      "Saqlagach fiskal chek chiqadi — chop etish yoki Telegramga yuborish mumkin.",
    ],
    to: "/payments",
    tourTarget: "nav-/payments",
    roles: ["admin", "director"],
    keywords: ["to'lov qabul", "tolov qabul", "chek chiqar", "kassa qabul", "pul qabul"],
  },
  {
    key: "attendance",
    title: "Davomat belgilash",
    steps: [
      "«Davomat» bo'limiga o'ting.",
      "Guruh va sanani tanlang.",
      "Har bir o'quvchi yonidagi holatni belgilang (keldi / kelmadi / sababli).",
      "Saqlaganda kelmagan o'quvchining ota-onasiga Telegram xabari ketadi.",
    ],
    to: "/attendance",
    tourTarget: "nav-/attendance",
    roles: ["admin", "director", "teacher"],
    keywords: ["davomat", "kelmagan belgil", "yo'qlama", "yoqlama"],
  },
  {
    key: "group",
    title: "Guruh yaratish",
    steps: [
      "«Guruhlar» bo'limiga o'ting.",
      "«Yangi guruh» tugmasini bosing.",
      "Guruh nomi, fani, o'qituvchisi, xonasi va dars vaqtini kiriting.",
      "Saqlagach o'quvchilarni guruhga biriktirasiz.",
    ],
    to: "/groups",
    tourTarget: "nav-/groups",
    roles: ["admin", "director", "teacher"],
    keywords: ["guruh yarat", "guruh qo'sh", "guruh qosh", "yangi guruh"],
  },
  {
    key: "credentials",
    title: "Login-parol yaratish",
    steps: [
      "«Sozlamalar» → «Login va parollar» bo'limiga o'ting.",
      "Rolni tanlang (administrator, direktor, o'qituvchi, o'quvchi).",
      "Ism va login kiriting yoki generator tugmasini bosing.",
      "Parolni saqlab, foydalanuvchiga bering.",
    ],
    to: "/settings/credentials",
    roles: ["admin", "director"],
    keywords: ["login parol", "parol yarat", "login yarat", "foydalanuvchi yarat"],
  },
  {
    key: "telegram",
    title: "Telegram ID ulash",
    steps: [
      "«Sozlamalar» → «Login va parollar» bo'limidagi Telegram panelini oching.",
      "Kerakli foydalanuvchi uchun ulanish kodini yarating.",
      "Kodni @AkhmadAcademylifebot ga yuboring.",
      "Ulanganidan keyin xabarlar avtomatik shu Telegramga tushadi.",
    ],
    to: "/settings/credentials",
    roles: ["admin", "director", "teacher"],
    keywords: ["telegram id", "telegram ulash", "bot ulash", "telegram bog'la"],
  },
  {
    key: "import",
    title: "Excel'dan ma'lumot import qilish",
    steps: [
      "«Excel import» bo'limiga o'ting.",
      "Import turini tanlang (o'quvchilar yoki o'qituvchilar).",
      "Excel faylni yuklang va ustunlar mosligini tekshiring.",
      "«Import qilish» ni bosing — xato bo'lsa bitta tugma bilan bekor qilasiz.",
    ],
    to: "/import",
    tourTarget: "nav-/import",
    roles: ["admin", "director"],
    keywords: ["excel", "import", "ro'yxat yukla", "royxat yukla"],
  },
  {
    key: "report",
    title: "Hisobotni ko'rish va yuborish",
    steps: [
      "«Hisobotlar» bo'limiga o'ting.",
      "Davrni tanlang (kunlik, haftalik, oylik).",
      "Kerakli ko'rsatkichni ochib tahlil qiling.",
      "Kunlik hisobot har kuni 20:00 da direktor Telegramiga avtomatik tushadi.",
    ],
    to: "/reports",
    tourTarget: "nav-/reports",
    roles: ["admin", "director"],
    keywords: ["hisobot", "report", "otchet", "kunlik hisobot"],
  },
  {
    key: "debtors",
    title: "Qarzdorlar bilan ishlash",
    steps: [
      "«Qarzdorlar» bo'limiga o'ting.",
      "Kechikkan kunlar bo'yicha filtrlang.",
      "Ro'yxatdan o'quvchini tanlab eslatma yuboring.",
      "To'lov kelgach o'quvchi ro'yxatdan avtomatik chiqadi.",
    ],
    to: "/debtors",
    tourTarget: "nav-/debtors",
    roles: ["admin", "director"],
    keywords: ["qarzdor", "qarz", "to'lamagan", "tolamagan"],
  },
  {
    key: "video-lesson",
    title: "Video dars yuklash",
    steps: [
      "«Video darslar» bo'limiga o'ting.",
      "Sarlavha va guruhni tanlang.",
      "Video faylni yuklang (500 MB gacha).",
      "Joylagach o'quvchilar uni o'z ilovasida ko'radi.",
    ],
    to: "/video-lessons",
    tourTarget: "nav-/video-lessons",
    roles: ["teacher", "admin", "director"],
    keywords: ["video dars", "video yukla", "darslik yukla"],
  },
  {
    key: "schedule",
    title: "Dars jadvalini boshqarish",
    steps: [
      "«Dars jadvali» bo'limiga o'ting.",
      "Haftalik ko'rinishda kerakli kun va vaqtni tanlang.",
      "Guruh, o'qituvchi va xonani belgilang.",
      "Saqlagach jadval barcha rollarga ko'rinadi.",
    ],
    to: "/schedule",
    tourTarget: "nav-/schedule",
    roles: ["admin", "director", "teacher", "student"],
    keywords: ["dars jadval", "jadval tuz", "raspisaniya"],
  },
  {
    key: "guide",
    title: "Video qo'llanmadan foydalanish",
    steps: [
      "«Video qo'llanma» bo'limiga o'ting.",
      "O'z rolingiz tabini tanlang.",
      "Videoni ochib ko'ring — ko'rilgani avtomatik belgilanadi.",
      "Administrator yangi video qo'shishi ham mumkin.",
    ],
    to: "/guide",
    tourTarget: "nav-/guide",
    roles: ["admin", "director", "teacher", "student"],
    keywords: ["qo'llanma", "qollanma", "video darslik", "o'rgat", "orgat", "yordam"],
  },
];

const QUESTION_RE = /(qanday|qanaqa|qayerdan|qayerda|qilaman|qilinadi|nima qil|o'rgat|orgat|ko'rsat|korsat|yordam)/i;

export function findHowTo(text: string, role: string): HowTo | null {
  const q = text.toLowerCase();
  let best: { item: HowTo; score: number } | null = null;
  for (const item of HOW_TOS) {
    if (!item.roles.includes(role as HowTo["roles"][number])) continue;
    for (const keyword of item.keywords) {
      if (q.includes(keyword)) {
        const score = keyword.length;
        if (!best || score > best.score) best = { item, score };
      }
    }
  }
  if (!best) return null;
  // Faqat "qanday/qayerdan" tipidagi savollarga qadamli javob beramiz,
  // aks holda oddiy navigatsiya yoki AI javobi ishlaydi.
  return QUESTION_RE.test(q) ? best.item : null;
}

export function formatHowTo(item: HowTo): string {
  const lines = item.steps.map((step, i) => `${i + 1}. ${step}`).join("\n");
  return `📘 ${item.title}\n\n${lines}`;
}

/** Sahifaga mos taklif savollar (kontekstli yordam). */
export function contextualSuggestions(pathname: string, role: string): string[] {
  const byPath: Record<string, string[]> = {
    "/students": ["Yangi o'quvchini qanday qo'shaman?", "Excel'dan qanday import qilaman?"],
    "/teachers": ["Yangi o'qituvchini qanday qo'shaman?", "Login parolni qanday yarataman?"],
    "/payments": ["To'lovni qanday qabul qilaman?", "Chekni qanday chiqaraman?"],
    "/attendance": ["Davomatni qanday belgilaymiz?", "Kelmaganlar bormi?"],
    "/groups": ["Guruhni qanday yarataman?", "Guruhga o'quvchi qanday qo'shiladi?"],
    "/finance": ["Bugungi tushum qancha?", "Qarzdorlar qancha?"],
    "/reports": ["Kunlik hisobotni qanday ko'raman?", "Hisobot Telegramga tushadimi?"],
    "/schedule": ["Dars jadvalini qanday tuzaman?", "Bugun qanday darslar bor?"],
    "/video-lessons": ["Video darsni qanday yuklayman?"],
    "/import": ["Excel'dan qanday import qilaman?"],
    "/settings": ["Login parolni qanday yarataman?", "Telegram ID ni qanday ulayman?"],
    "/debtors": ["Qarzdorlarga eslatma qanday yuboriladi?"],
  };
  const match = Object.keys(byPath).find((key) => pathname.startsWith(key));
  const base = match ? byPath[match]! : [];
  const fallback =
    role === "teacher"
      ? ["Davomatni qanday belgilaymiz?", "Video darsni qanday yuklayman?", "KPI qanday hisoblanadi?"]
      : ["Yangi o'quvchini qanday qo'shaman?", "To'lovni qanday qabul qilaman?", "Hisobot bormi?"];
  return Array.from(new Set([...base, ...fallback])).slice(0, 4);
}
