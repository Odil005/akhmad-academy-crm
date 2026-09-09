import { useCallback, useEffect, useState } from "react";

export type Lang = "uz" | "ru";

const LANG_KEY = "akhmad.lang";
const LANG_EVENT = "akhmad:lang";

/** UI matnlari — o'zbek (asosiy) va rus tili. */
const RU: Record<string, string> = {
  // Navigatsiya
  "O'qituvchi paneli": "Панель преподавателя",
  "Video darslar": "Видеоуроки",
  "Bilim o'yini": "Интеллектуальная игра",
  "Maqsad xaritasi": "Карта цели",
  Metodika: "Методика",
  "Video qo'llanma": "Видеоруководство",
  Boshqaruv: "Панель управления",
  "O'quvchilar": "Ученики",
  Guruhlar: "Группы",
  "O'qituvchilar ro'yxati": "Список преподавателей",
  "Dars jadvali": "Расписание",
  "Face ID lokatsiya": "Локация Face ID",
  Davomat: "Посещаемость",
  "To'lovlar": "Платежи",
  Moliya: "Финансы",
  Qarzdorlar: "Должники",
  "Kassa yopilishi": "Закрытие кассы",
  "Chek tasdiqlash": "Подтверждение чека",
  "Oylik hisobi": "Расчёт зарплаты",
  Lidlar: "Лиды",
  "Qo'ng'iroqlar": "Звонки",
  Xabarlar: "Сообщения",
  Xonalar: "Кабинеты",
  "Dars faolligi": "Активность на уроке",
  "Face ID": "Face ID",
  "O'qituvchi balansi": "Баланс преподавателя",
  "Oylik KPI": "Месячный KPI",
  Marketplace: "Маркетплейс",
  Hisobotlar: "Отчёты",
  "Excel import": "Импорт Excel",
  "UNI CRM platforma": "Платформа UNI CRM",
  Sozlamalar: "Настройки",
  "Boshqa bo'limlar": "Другие разделы",
  // Topbar
  Chiqish: "Выйти",
  "Xush kelibsiz": "Добро пожаловать",
  "O'quvchi yoki telefon raqamini qidiring": "Поиск ученика или номера телефона",
  "Tizimni o'rgatuvchi tur": "Обучающий тур по системе",
  "Boshlash vazifalari": "Задачи для старта",
  Til: "Язык",
  // Ogohlantirishlar
  "Tizim ogohlantirishlari": "Системные оповещения",
  "Administrator uchun avtomatik nazorat": "Автоматический контроль для администратора",
  "Qayta tekshirish": "Проверить снова",
  "Tekshirilmoqda...": "Проверка...",
  "Hammasi joyida": "Всё в порядке",
  "Tizimda administrator aralashuvi kerak bo'lgan muammo yo'q.":
    "Нет проблем, требующих вмешательства администратора.",
  "Ovozli signal yoniq": "Звуковой сигнал включён",
  "Ovozli signal o'chirilgan": "Звуковой сигнал выключен",
  "Ovoz balandligi": "Громкость сигнала",
  "Tizimda muammo aniqlanmadi": "Проблем в системе не обнаружено",
};

export function translate(lang: Lang, text: string): string {
  if (lang === "uz") return text;
  return RU[text] ?? text;
}

function readLang(): Lang {
  try {
    return window.localStorage.getItem(LANG_KEY) === "ru" ? "ru" : "uz";
  } catch {
    return "uz";
  }
}

/** Tilni o'qiydi va o'zgartiradi; barcha komponentlar bir vaqtda yangilanadi. */
export function useLanguage() {
  const [lang, setLang] = useState<Lang>("uz");

  useEffect(() => {
    setLang(readLang());
    const onChange = () => setLang(readLang());
    window.addEventListener(LANG_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(LANG_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const changeLang = useCallback((next: Lang) => {
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      /* storage bloklangan bo'lishi mumkin */
    }
    window.dispatchEvent(new Event(LANG_EVENT));
  }, []);

  const t = useCallback((text: string) => translate(lang, text), [lang]);

  return { lang, setLang: changeLang, t };
}
