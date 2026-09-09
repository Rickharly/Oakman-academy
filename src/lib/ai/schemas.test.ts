import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";

/**
 * Every schema we ask the model to fill in must be one the API will accept.
 *
 * Structured outputs run in strict mode: a schema containing an optional field is rejected, and
 * the SDK throws before anything is sent. That failure is invisible in the ordinary way — the
 * call does not return bad data, it never happens — so it reaches a child as "the lesson isn't
 * generating" or "the practice button does nothing", with nothing in between to point at the
 * cause. One `.optional()` in a schema stopped every lesson from being written; two more had
 * been quietly stopping practice questions from being generated at all.
 *
 * `.nullable()` is the way to say "may be absent" here. This test is the only thing standing
 * between a one-word mistake and a child sitting in front of a page that will not load.
 */
const SCHEMAS: Record<string, () => Promise<ZodType>> = {
  lesson_explainer: async () => (await import("@/lib/lessons/explainer")).explainerSchema,
  worksheet_tasks: async () => (await import("@/lib/lessons/worksheet")).worksheetSchema,
  understanding_gaps: async () => (await import("@/lib/lessons/understanding")).gapsSchema,
  reteach: async () => (await import("@/lib/lessons/understanding")).reteachSchema,
  explain_back: async () => (await import("@/lib/lessons/understanding")).judgeSchema,
  practice: async () => (await import("@/lib/ai/teacher-agent")).practiceSchema,
  daySummary: async () => (await import("@/lib/ai/teacher-agent")).daySummarySchema,
  lessonSummary: async () => (await import("@/lib/ai/teacher-agent")).lessonSummarySchema,
  misconceptions: async () => (await import("@/lib/ai/teacher-agent")).observationsSchema,
  lesson_sequence: async () => (await import("@/lib/curriculum/generate")).sequenceSchema,
  lesson_quiz: async () => (await import("@/lib/curriculum/generate")).quizSchema,
  structured_worksheet: async () =>
    (await import("@/lib/questions/worksheet-pipeline")).structuredWorksheetSchema,
};

describe("schemas the model is asked to fill in", () => {
  for (const [name, load] of Object.entries(SCHEMAS)) {
    it(`"${name}" is one the API will accept`, async () => {
      const schema = await load();
      // Throws on `.optional()` without `.nullable()`, among other strict-mode violations.
      expect(() => zodTextFormat(schema, name)).not.toThrow();
    });
  }
});
