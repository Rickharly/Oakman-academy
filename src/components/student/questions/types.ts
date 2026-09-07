/**
 * Shared props contract for the per-question-type renderers. `value` and
 * `onChange` carry the canonical `response` shape for the question's type
 * (see `src/lib/questions/types.ts` — `responseSchemas`); `question.options`
 * and `question.promptImage` are the canonical `options`/image shapes from
 * the same module. Kept loose (`unknown`) here because each renderer knows
 * its own shape and narrows on the way in.
 */
export type StudentQuestionLite = {
  id: string;
  type: string;
  prompt: string;
  promptImage?: unknown;
  options?: unknown;
  maxScore: number;
};

/** Graded state for one question, once its stage has been submitted. */
export type QuestionResult = {
  isCorrect: boolean | null;
  score: number | null;
  maxScore: number;
  feedback: string | null;
  /**
   * The question's answer key — present only when the server decided this
   * question may reveal it (immediately for STARTER/PRACTICE; for CHECK only
   * once no retry remains). Renderers must never show a correct answer
   * unless this is set.
   */
  answerKey?: unknown;
};

export type QuestionRendererProps = {
  question: StudentQuestionLite;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  result?: QuestionResult;
};

export type Option = { id: string; text: string; image?: { url: string; alt?: string } };
