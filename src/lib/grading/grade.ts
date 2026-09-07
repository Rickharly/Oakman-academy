/**
 * `gradeQuestion` — the single entry point lesson flow calls to grade one answer
 * (ARCHITECTURE §5). Deterministic first; AI only when the question is marked
 * `gradingMode: "AI"` or the deterministic grader can't decide (SHORT_ANSWER miss).
 */
import type { AiProvider } from "@/lib/ai/provider";
import { teacherAgent } from "@/lib/ai/teacher-agent";
import type { Question } from "@/generated/prisma/client";
import type { GradeResult } from "@/lib/questions/types";
import { gradeDeterministic } from "./deterministic";

export interface GradingContext {
  studentYearGroup: number;
  lesson: {
    title: string;
    keyLearningPoints: string[];
    misconceptions: { misconception: string; response: string }[];
  };
  ai?: AiProvider;
}

export async function gradeQuestion(
  question: Question,
  response: unknown,
  ctx: GradingContext,
): Promise<GradeResult & { gradedBy: "DETERMINISTIC" | "AI"; raw?: unknown }> {
  if (question.gradingMode !== "AI") {
    const deterministic = gradeDeterministic(question, response);
    if (deterministic) {
      return {
        ...deterministic,
        gradedBy: "DETERMINISTIC",
        raw: { method: "deterministic", questionType: question.type, response },
      };
    }
  }

  const ai = await teacherAgent.grade({ question, response, ctx });
  return {
    score: ai.score,
    maxScore: ai.maxScore,
    correct: ai.correct,
    mastery: ai.mastery,
    feedbackForStudent: ai.feedbackForStudent,
    reasoningForParent: ai.reasoningForParent,
    misconceptions: ai.misconceptions,
    needsReview: ai.needsReview,
    gradedBy: "AI",
    raw: { method: "ai", model: ai.model, trace: ai.raw },
  };
}
