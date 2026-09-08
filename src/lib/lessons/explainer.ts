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

/**
 * Bumped whenever the way a lesson is written changes materially.
 *
 * Stored lessons carry the version they were written under, so an improvement reaches the
 * children who already have the old one instead of only new lessons. The first fractions
 * lesson we wrote opened with "the top number is called the numerator" — correct, and useless.
 */
export const EXPLAINER_VERSION = 2;

export const explainerSchema = z.object({
  /** The version of these instructions this was written under. */
  version: z.number().optional(),
  /**
   * The one real thing this whole lesson is explained with — "a pizza cut into slices", "the
   * bar of chocolate in your bag", "the pitch at half time".
   *
   * Required, and required to be a thing a child has actually held or seen, because the way a
   * lesson goes wrong is by explaining an abstraction with another abstraction. Every section
   * has to keep coming back to this one.
   */
  everydayAnchor: z.string(),
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

/**
 * A stored lesson, if it is still usable.
 *
 * Rejects a shape that no longer parses, and a lesson written under an older set of
 * instructions — those get rewritten rather than shown, because leaving a child with the worse
 * explanation is the whole problem we were fixing.
 */
export function parseExplainer(value: unknown): LessonExplainer | null {
  const parsed = explainerSchema.safeParse(value);
  if (!parsed.success) return null;
  if ((parsed.data.version ?? 1) < EXPLAINER_VERSION) return null;
  return parsed.data;
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
  opts: { force?: boolean; studentId?: string } = {},
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

  // What this child is into, when we know. An anchor drawn from something they already care
  // about is the difference between a lesson they follow and one they endure.
  const student = opts.studentId
    ? await prisma.studentProfile.findUnique({ where: { id: opts.studentId }, select: { interests: true } })
    : null;
  const interests = Array.isArray(student?.interests)
    ? (student.interests as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  const interestsLine =
    interests.length > 0
      ? `\nThis child is into ${interests.join(", ")}. If one of those makes a natural anchor for this topic, use it. If it would be a stretch, pick something everyday instead — a forced example is worse than a plain one.`
      : "";

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
      "You are a teacher sitting next to one child, teaching them this for the first time. They",
      "have not met this topic before. Assume nothing.",
      "",
      registerFor(yearGroup),
      interestsLine,
      "",
      "The one rule that matters most: TEACH THE THING BEFORE YOU NAME IT.",
      "",
      "A child who is read a definition has learnt a sentence, not an idea. So every idea in",
      "this lesson arrives as something real first — something they have held, eaten, seen or",
      "done — and only then gets its proper name. Pick ONE everyday thing at the start",
      "(everydayAnchor) and explain the whole lesson with it. Not a new example every section;",
      "the same one, coming back, getting a little more done to it each time.",
      "",
      "What a bad version of this looks like, so you can avoid it:",
      '  "When we write 1/2, the top number is called the numerator. Numerator means how many',
      '   parts we have. The bottom number is the denominator."',
      "That teaches nothing. It is three names and no picture.",
      "",
      "What a good version looks like:",
      '  "You cut a pizza down the middle and take one piece. You have got one piece, out of the',
      '   two the whole pizza was cut into. That is what we write as 1/2 — the 2 underneath says',
      '   how many pieces the pizza was cut into, the 1 on top says how many you took."',
      "Same facts. The child can see it.",
      "",
      "Rules:",
      "- NEVER open a section with a definition or a technical word. Open with the thing itself.",
      "- Never explain a word with another word they do not have. If you catch yourself writing",
      '  "multiply means to scale by repeated addition", stop: show two lots of something instead.',
      "- Keep the anchor. If it is a chocolate bar in section one, it is the same chocolate bar",
      "  in section four. Switching to bar models and number lines mid-lesson loses them.",
      "- Short sentences. One idea each. Read it back as if aloud — if you would not say it",
      "  standing next to a child, rewrite it.",
      "- Sections build in order: each uses what the last one established.",
      "- The worked example is done in full, every step said out loud, in the same everyday",
      "  terms — not a change of register into exam language. Set it to null only when the",
      "  subject genuinely has nothing to work through.",
      "- 'watchOutFor' names the mistake children actually make here, shows it going wrong with",
      "  the anchor, and corrects it. Null if the material does not suggest one.",
      "- 'thinkAbout' is one question they should be able to answer after reading. Do not give",
      "  its answer — it is theirs to work out.",
      "- Never invent facts, dates or figures that are not in the material below. If the material",
      "  is thin, teach what is there properly rather than padding it out.",
      "- UK English. Plain prose. No markdown, no headings inside a body, no bullet characters,",
      "  no lists — this gets read aloud.",
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

  const stamped = { ...data, version: EXPLAINER_VERSION };
  await prisma.lesson.update({
    where: { id: lesson.id },
    data: { explainer: stamped, explainerAt: new Date() },
  });

  return stamped;
}
