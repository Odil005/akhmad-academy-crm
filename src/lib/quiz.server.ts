import { resolveJarvisAIProvider } from "./jarvis-ai.server";

export type GeneratedQuestion = {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};

export function createFallbackQuestions(
  subjectName: string,
  level: number,
  count: number,
): GeneratedQuestion[] {
  const templates = [
    {
      question: `${subjectName} fanini o'rganishda eng muhim odat qaysi?`,
      options: ["Muntazam mashq qilish", "Darslarni qoldirish", "Javobni taxmin qilish", "Faqat imtihon kuni o'qish"],
      correct_index: 0,
      explanation: "Muntazam mashq bilimni mustahkamlaydi.",
    },
    {
      question: `${subjectName} bo'yicha murakkab topshiriq uchrasa, avval nima qilish kerak?`,
      options: ["Shartni diqqat bilan o'qish", "Darhol taslim bo'lish", "Savolni o'tkazib yuborish", "Tasodifiy javob tanlash"],
      correct_index: 0,
      explanation: "Topshiriq shartini tushunish yechimning birinchi bosqichidir.",
    },
    {
      question: `Yangi ${subjectName} mavzusini yaxshiroq eslab qolish usuli qaysi?`,
      options: ["Misollar bilan takrorlash", "Bir marta ko'rib chiqish", "Mashq qilmaslik", "Faqat javobni yodlash"],
      correct_index: 0,
      explanation: "Misol va takrorlash mavzuni uzoq muddat eslab qolishga yordam beradi.",
    },
    {
      question: `${subjectName} darsida xato qilish nimani anglatadi?`,
      options: ["O'rganish imkoniyatini", "Darsni to'xtatishni", "Bahoni yashirishni", "Mavzuni almashtirishni"],
      correct_index: 0,
      explanation: "Xatoni tahlil qilish orqali bilim kuchayadi.",
    },
  ];

  return Array.from({ length: count }, (_, index) => {
    const item = templates[index % templates.length];
    return {
      ...item,
      question: level > 1 ? `${item.question} (Daraja ${level})` : item.question,
    };
  });
}

/** Ask the AI gateway for a small set of subject questions in Uzbek. */
export async function generateQuestions(
  subjectName: string,
  level: number,
  count: number,
): Promise<GeneratedQuestion[]> {
  const provider = resolveJarvisAIProvider();
  if (!provider) throw new Error("AI provider sozlanmagan");

  const prompt = [
    `Fan: ${subjectName}. Daraja: ${level} (1 = oson, 2 = o'rta, 3 = qiyin).`,
    `${count} ta test savoli tuz. Har bir savolda 4 ta variant bo'lsin, faqat bittasi to'g'ri.`,
    `Javobni faqat JSON qaytar: {"questions":[{"question":"...","options":["..","..","..",".."],"correct_index":0,"explanation":"qisqa izoh"}]}`,
    "Savollar o'zbek tilida, o'quv markazi o'quvchilari uchun tushunarli bo'lsin.",
  ].join("\n");

  const response = await fetch(`${provider.apiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.kind === "lovable" ? "google/gemini-3.6-flash" : provider.chatModel,
      messages: [
        { role: "system", content: "Sen tajribali o'qituvchisan. Faqat JSON qaytar." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI xatosi [${response.status}]: ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  const jsonText = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  let parsed: { questions?: unknown };
  try {
    parsed = JSON.parse(jsonText) as { questions?: unknown };
  } catch {
    throw new Error("AI javobini o'qib bo'lmadi");
  }

  const list = Array.isArray(parsed.questions) ? parsed.questions : [];
  return list
    .map((item) => {
      const row = item as Record<string, unknown>;
      const options = Array.isArray(row.options)
        ? row.options.map((o) => String(o).slice(0, 300)).filter(Boolean)
        : [];
      const idx = Number(row.correct_index);
      return {
        question: String(row.question ?? "").slice(0, 500),
        options,
        correct_index: Number.isFinite(idx) ? Math.min(Math.max(idx, 0), options.length - 1) : 0,
        explanation: row.explanation ? String(row.explanation).slice(0, 500) : null,
      };
    })
    .filter((q) => q.question.length > 4 && q.options.length === 4)
    .slice(0, count);
}
