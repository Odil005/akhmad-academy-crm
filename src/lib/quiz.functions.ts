import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createFallbackQuestions, generateQuestions } from "./quiz.server";

/**
 * Return quiz questions for a subject. Existing questions are reused; when the
 * bank is thin the AI generates and stores a fresh batch for everyone.
 */
export const getSubjectQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        subject_id: z.string().uuid().nullable().optional(),
        subject_name: z.string().trim(),
        level: z.number().int().optional(),
        count: z.number().int().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const level = Math.min(Math.max(data.level ?? 1, 1), 3);
    const count = Math.min(Math.max(data.count ?? 8, 3), 12);
    const subjectName = data.subject_name.slice(0, 120) || "Umumiy bilim";

    const bank = context.supabase.from("quiz_questions").select("*").eq("level", level).limit(60);
    const { data: existing, error: readError } = data.subject_id
      ? await bank.eq("subject_id", data.subject_id)
      : await bank.eq("subject_name", subjectName);

    let pool = (existing ?? []) as {
      id: string;
      question: string;
      options: string[];
      correct_index: number;
      explanation: string | null;
    }[];

    if (!readError && pool.length < count) {
      try {
        const generated = await generateQuestions(subjectName, level, count);
        if (generated.length > 0) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: inserted } = await supabaseAdmin
            .from("quiz_questions")
            .insert(
              generated.map((q) => ({
                subject_id: data.subject_id ?? null,
                subject_name: subjectName,
                question: q.question,
                options: q.options,
                correct_index: q.correct_index,
                explanation: q.explanation,
                level,
                created_by: context.userId,
              })),
            )
            .select("id, question, options, correct_index, explanation");
          pool = [...pool, ...((inserted ?? []) as typeof pool)];
        }
      } catch (error) {
        console.error("Quiz generation failed; using fallback questions", error);
      }
    }

    if (pool.length < count) {
      const fallback = createFallbackQuestions(subjectName, level, count - pool.length).map(
        (question, index) => ({
          id: `fallback-${level}-${index}`,
          ...question,
        }),
      );
      pool = [...pool, ...fallback];
    }

    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
    return {
      subject_name: subjectName,
      level,
      questions: shuffled.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
      })),
    };
  });
