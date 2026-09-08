/**
 * The lesson, taught.
 *
 * Oak gives us a lesson's key learning points, keywords and misconceptions. Those are notes
 * for a teacher — they are not a lesson. A child who opened a lesson on decibels got a bullet
 * list and then a quiz, had never met a decibel, and was through the whole period in ten
 * minutes. That is not them working quickly; that is nothing being taught.
 *
 * So the teacher writes the lesson out: what it is about and why it matters, three or four
 * short taught sections that build, a worked example done in full, and a question to think
 * about before the quiz. Written once per lesson and stored, because it does not change
 * between children and paying for it twice is waste.
 *
 * A video, where one exists, is still the better lesson — this sits alongside it as the words,
 * and stands in for it when there is none.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAiProvider } from "@/lib/ai/provider";

export const explainerSchema = z.object({
  /** "Today we're looking at…" — what this is, why anyone cares. 2-3 sentences. */
  intro: z.string(),
  /** The teaching, in order. Each one short enough to hold in your head. */
  sections: z
    .array(
      z.object({
        heading: z.string(),
        /** Two to five sentences. Prose, spoken aloud, not notes. */
        body: z.string(),
      }),
    )
    .min(2)
    .max(6),
  /** One problem done in full, the way a teacher does it on the board. */
  workedExample: z
    .object({
      question: z.string(),
      steps: z.array(z.string()).min(1).max(8),
      answer: z.string(),
    })
    .nullable(),
  /** The thing children usually get wrong here, named and corrected. */
  watchOutFor: z.string().nullable(),
  /** One question to think about — not marked, just to make them stop and check. */
  thinkAbout: z.string(),
});

export type LessonExplainer = z.infer<typeof explainerSchema>;

/** Rejects a stored value that no longer matches the shape, rather than rendering rubbish. */
export function parseExplainer(value: unknown): LessonExplainer | null {
  const parsed = explainerSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asPairs(value: unknown, a: string, b: string): string[] {
  return Array.isArray(value)
    ? value
        .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
        .map((v) => `${String(v[a] ?? "")}: ${String(v[b] ?? "")}`)
        .filter((line) => line.length > 2)
    : [];
}

/**
 * How to talk to this year group. Deliberately close to the teacher's own register rules —
 * the lesson a child reads and the teacher they ask about it should sound like one person.
 */
function registerFor(yearGroup: number): string {
  if (yearGroup <= 4) {
    return (
      "This is for an eight or nine year old. One idea per sentence, everyday words, and " +
      "something they can picture — a thing in a room, not an abstraction. Every subject word " +
      "you use must be explained in the same breath you use it."
    );
  }
  if (yearGroup <= 6) {
    return (
      "This is for a ten or eleven year old. Short sentences and concrete examples. Subject " +
      "vocabulary is fine, but define it the first time it appears."
    );
  }
  if (yearGroup <= 9) {
    return (
      "This is for a twelve to fourteen year old. Clear and direct, proper subject vocabulary " +
      "introduced with a plain-English definition, examples from a world they recognise."
    );
  }
  return (
    "This is for a fifteen or sixteen year old. A grown-up tone and full subject terminology, " +
    "still explained the first time it is used."
  );
}

/**
 * The lesson written out, generated on first request and stored on the lesson.
 *
 * `force` rewrites it — for a parent who reads one and finds it thin.
 */
export async function getOrCreateExplainer(
  lessonId: string,
  opts: { force?: boolean } = {},
): Promise<LessonExplainer | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { unit: { include: { programme: { include: { subject: true } } } } },
  });
  if (!lesson) return null;

  if (!opts.force) {
    const stored = parseExplainer(lesson.explainer);
    if (stored) return stored;
  }

  const yearGroup = lesson.unit.programme.yearGroup;
  const keyPoints = asStrings(lesson.keyLearningPoints);
  const keywords = asPairs(lesson.keywords, "keyword", "description");
  const misconceptions = asPairs(lesson.misconceptions, "misconception", "response");

  // With nothing to teach from, an "explanation" would be the model inventing a lesson. A
  // child is better served by us saying there is no material than by confident fiction.
  if (keyPoints.length === 0 && keywords.length === 0 && !lesson.transcript && !lesson.pupilOutcome) {
    return null;
  }

  const ai = getAiProvider();
  const { data } = await ai.structured({
    model: "strong",
    schemaName: "lesson_explainer",
    schema: explainerSchema,
    system: [
      "You are a teacher, teaching a lesson to one child. Write the lesson out as you would",
      "say it standing next to them — not as revision notes, not as a summary, not as bullet",
      "points with the verbs removed. They have not met this topic before. Assume nothing.",
      "",
      registerFor(yearGroup),
      "",
      "Rules:",
      "- Start from what they already know and build. Never open with the technical term; open",
      "  with the thing it describes, then name it.",
      "- Every new word gets a plain definition the moment it appears.",
      "- Sections must build in order: each one uses what the last one established.",
      "- The worked example is done in full, every step shown and said aloud. Set it to null",
      "  only when the subject genuinely has nothing to work through (some history lessons).",
      "- 'watchOutFor' names the mistake children actually make here and corrects it. Null if",
      "  the lesson material does not suggest one.",
      "- 'thinkAbout' is one question they should be able to answer after reading. Do not give",
      "  its answer — they are about to be quizzed, and it is theirs to work out.",
      "- Never invent facts, dates or figures that are not in the material below. If the",
      "  material is thin, teach what is there properly rather than padding it out.",
      "- UK English. Plain prose. No markdown, no headers inside a body, no bullet characters.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          `Subject: ${lesson.unit.programme.subject.title} (Year ${yearGroup})`,
          `Unit: ${lesson.unit.title}`,
          `Lesson: ${lesson.title}`,
          lesson.pupilOutcome ? `By the end they should be able to: ${lesson.pupilOutcome}` : "",
          "",
          keyPoints.length > 0 ? "Key learning points:" : "",
          ...keyPoints.map((p) => `- ${p}`),
          "",
          keywords.length > 0 ? "Keywords:" : "",
          ...keywords.map((k) => `- ${k}`),
          "",
          misconceptions.length > 0 ? "Common misconceptions:" : "",
          ...misconceptions.map((m) => `- ${m}`),
          "",
          lesson.transcript
            ? `The original lesson's transcript — teach from this where it is useful:\n${lesson.transcript.slice(0, 12000)}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  await prisma.lesson.update({
    where: { id: lesson.id },
    data: { explainer: data, explainerAt: new Date() },
  });

  return data;
}
