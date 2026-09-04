/**
 * Canonical question/answer shapes stored in Question.options, Question.answerKey
 * and QuestionAttempt.response. Every provider (Oak, PDF worksheet extraction,
 * AI-generated practice, parent custom) converts INTO these shapes; the UI and
 * the graders only ever see these.
 */
import { z } from "zod";

export const imageSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  alt: z.string().optional(),
  attribution: z.string().optional(),
});
export type ImageRef = z.infer<typeof imageSchema>;

export const optionSchema = z.object({
  id: z.string(),
  text: z.string(),
  image: imageSchema.optional(),
});
export type Option = z.infer<typeof optionSchema>;

// ---------- options (what the student is shown) ----------

export const choiceOptionsSchema = z.object({ choices: z.array(optionSchema).min(2) });
export const matchingOptionsSchema = z.object({
  left: z.array(optionSchema).min(2),
  right: z.array(optionSchema).min(2),
});
export const orderingOptionsSchema = z.object({ items: z.array(optionSchema).min(2) });
export const numericOptionsSchema = z.object({ unit: z.string().optional(), placeholder: z.string().optional() });
export const textOptionsSchema = z.object({
  placeholder: z.string().optional(),
  minWords: z.number().optional(),
  maxWords: z.number().optional(),
});

// ---------- answer keys (what makes an answer correct) ----------

export const multipleChoiceKeySchema = z.object({ correctOptionId: z.string() });
export const multiSelectKeySchema = z.object({ correctOptionIds: z.array(z.string()).min(1) });
export const trueFalseKeySchema = z.object({ value: z.boolean() });
export const shortAnswerKeySchema = z.object({
  /** Any of these, after normalisation, counts as correct. Empty → AI grading. */
  accepted: z.array(z.string()),
  caseSensitive: z.boolean().default(false),
  /** Optional model answer / notes used when AI grading is needed. */
  modelAnswer: z.string().optional(),
});
export const extendedTextKeySchema = z.object({
  modelAnswer: z.string().optional(),
  rubric: z.string().optional(),
  keyPoints: z.array(z.string()).optional(),
});
export const numericKeySchema = z.object({
  value: z.number(),
  tolerance: z.number().default(0),
  /** alternative exact strings such as "3/4" that also count */
  acceptedStrings: z.array(z.string()).optional(),
});
export const matchingKeySchema = z.object({
  pairs: z.array(z.object({ leftId: z.string(), rightId: z.string() })).min(1),
});
export const orderingKeySchema = z.object({ order: z.array(z.string()).min(2) });

export const answerKeySchemas = {
  MULTIPLE_CHOICE: multipleChoiceKeySchema,
  MULTI_SELECT: multiSelectKeySchema,
  TRUE_FALSE: trueFalseKeySchema,
  SHORT_ANSWER: shortAnswerKeySchema,
  EXTENDED_TEXT: extendedTextKeySchema,
  NUMERIC: numericKeySchema,
  MATCHING: matchingKeySchema,
  ORDERING: orderingKeySchema,
} as const;

export const optionsSchemas = {
  MULTIPLE_CHOICE: choiceOptionsSchema,
  MULTI_SELECT: choiceOptionsSchema,
  TRUE_FALSE: z.object({}).optional(),
  SHORT_ANSWER: textOptionsSchema.optional(),
  EXTENDED_TEXT: textOptionsSchema.optional(),
  NUMERIC: numericOptionsSchema.optional(),
  MATCHING: matchingOptionsSchema,
  ORDERING: orderingOptionsSchema,
} as const;

// ---------- student responses ----------

export const responseSchemas = {
  MULTIPLE_CHOICE: z.object({ optionId: z.string() }),
  MULTI_SELECT: z.object({ optionIds: z.array(z.string()) }),
  TRUE_FALSE: z.object({ value: z.boolean() }),
  SHORT_ANSWER: z.object({ text: z.string() }),
  EXTENDED_TEXT: z.object({ text: z.string() }),
  NUMERIC: z.object({ text: z.string() }), // raw input; parsed by the grader ("0.75", "3/4")
  MATCHING: z.object({ pairs: z.array(z.object({ leftId: z.string(), rightId: z.string() })) }),
  ORDERING: z.object({ order: z.array(z.string()) }),
} as const;

export type QuestionTypeName = keyof typeof answerKeySchemas;

export type AnswerKeyOf<T extends QuestionTypeName> = z.infer<(typeof answerKeySchemas)[T]>;
export type ResponseOf<T extends QuestionTypeName> = z.infer<(typeof responseSchemas)[T]>;
export type OptionsOf<T extends QuestionTypeName> = z.infer<NonNullable<(typeof optionsSchemas)[T]>>;

export type AnyAnswerKey = { [K in QuestionTypeName]: AnswerKeyOf<K> }[QuestionTypeName];
export type AnyResponse = { [K in QuestionTypeName]: ResponseOf<K> }[QuestionTypeName];

/** Structured output every grader (deterministic or AI) must produce. */
export const gradeResultSchema = z.object({
  score: z.number(),
  maxScore: z.number(),
  correct: z.boolean(),
  /** 0–1 estimate of how well the concept is understood */
  mastery: z.number().min(0).max(1),
  feedbackForStudent: z.string(),
  reasoningForParent: z.string(),
  misconceptions: z.array(z.string()),
  needsReview: z.boolean(),
});
export type GradeResult = z.infer<typeof gradeResultSchema>;

/** Which question types can be graded without AI. */
export const DETERMINISTIC_TYPES: ReadonlySet<QuestionTypeName> = new Set([
  "MULTIPLE_CHOICE",
  "MULTI_SELECT",
  "TRUE_FALSE",
  "NUMERIC",
  "MATCHING",
  "ORDERING",
]);
