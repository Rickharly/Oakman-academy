/**
 * `MockProvider` is what actually exercises every AI call site in this repo — there is no
 * network access to OpenAI here, so `AI_PROVIDER=mock` runs in every test and in dev. A payload
 * that only "mostly" fits its schema throws the instant structured outputs run in strict mode,
 * and the failure looks like the model declining rather than a bug in the mock (exactly what
 * happened to `practice` and `daySummary`: see teacher-agent.ts). This runs every payload the
 * mock knows how to produce through the real schema its real call site asks for, so a future
 * schema change that the mock isn't updated to match fails here instead of at runtime.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MockProvider } from "./mock-provider";
import { practiceSchema, daySummarySchema, lessonSummarySchema, observationsSchema, summarySchema } from "./teacher-agent";
import { gradeResultSchema } from "@/lib/questions/types";
import { structuredWorksheetSchema } from "@/lib/questions/worksheet-pipeline";
import { chapterPromptsSchema, responseFeedbackSchema, essayFeedbackSchema } from "@/lib/reading/service";

const provider = new MockProvider();

/** One entry per `schemaName` the mock provider recognises, paired with the actual schema its
 * real call site validates against (ARCHITECTURE §6). */
const cases: { schemaName: string; schema: z.ZodTypeAny; system: string }[] = [
  { schemaName: "grade", schema: gradeResultSchema, system: "STUDENT ANSWER: three quarters\nMODEL ANSWER: 3/4" },
  { schemaName: "lessonSummary", schema: lessonSummarySchema, system: "LESSON: Fractions" },
  { schemaName: "daySummary", schema: daySummarySchema, system: "Write a day summary." },
  { schemaName: "practice", schema: practiceSchema, system: "LESSON: Fractions" },
  { schemaName: "misconceptions", schema: observationsSchema, system: "LESSON: Fractions" },
  { schemaName: "readingResponse", schema: responseFeedbackSchema, system: "Reply to a reading journal." },
  { schemaName: "readingEssay", schema: essayFeedbackSchema, system: "Mark an essay." },
  { schemaName: "chapterPrompts", schema: chapterPromptsSchema, system: "Set chapter questions." },
  { schemaName: "structured_worksheet", schema: structuredWorksheetSchema, system: "Structure a worksheet." },
  { schemaName: "conversationSummary", schema: summarySchema, system: "Summarise a conversation." },
];

describe("every mock structured payload satisfies its own schema", () => {
  for (const { schemaName, schema, system } of cases) {
    it(`"${schemaName}"`, async () => {
      const { data } = await provider.structured({
        model: "fast",
        schemaName,
        schema,
        system,
        messages: [
          {
            role: "user",
            content: 'Some student writing.\n"""\nA paragraph of student writing goes here.\n"""',
          },
        ],
      });
      // `structured()` already parses the fake payload with the caller's own schema before
      // returning it — a mismatch throws before this line. Parsing it again here is the
      // assertion: it proves the payload was genuinely valid, not that nothing threw.
      expect(schema.safeParse(data).success).toBe(true);
    });
  }

  it("falls back to a best-effort object, but still throws rather than inventing data, for a schema it does not recognise", async () => {
    const madeUp = z.object({ mustHave: z.string() });
    await expect(
      provider.structured({
        model: "fast",
        schemaName: "not_a_real_schema_name",
        schema: madeUp,
        system: "irrelevant",
        messages: [{ role: "user", content: "hello" }],
      }),
    ).rejects.toThrow();
  });
});
