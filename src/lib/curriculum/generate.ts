/**
 * Real lessons, written here, when the provider cannot supply them.
 *
 * Oak is the better source and stays the first choice. But a child's school day cannot depend
 * on somebody else's API being reachable, in quota, and holding the subject we need — and when
 * it is not, the alternatives are all bad: a short day, a day padded with revision, or the same
 * subject four times. Those are what happens when the app has nothing to teach and says so
 * politely.
 *
 * So the teacher writes the lessons. A proper sequence for the subject and year, in teaching
 * order, continuing from whatever the child has already done — each with its own learning
 * points, keywords, and a quiz that marks itself. They are ordinary lessons in every way the
 * rest of the app cares about; the only difference is the provider they are stamped with, so a
 * parent can always tell which is which.
 *
 * Written into the curriculum tables, which is why this lives in `src/lib/curriculum` rather
 * than beside the teacher (CLAUDE.md rule 1).
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAiProvider } from "@/lib/ai/provider";
import type { Lesson } from "@/generated/prisma/client";

/** Stamped on everything written here, so it is never confused with the provider's own. */
export const GENERATED_PROVIDER = "oakman";

const SUBJECT_TITLES: Record<string, string> = {
  maths: "Maths",
  english: "English",
  science: "Science",
  history: "History",
  geography: "Geography",
  art: "Art",
  music: "Music",
};

export const sequenceSchema = z.object({
  /** The unit these lessons belong to — "Fractions", "The Romans". */
  unitTitle: z.string(),
  lessons: z
    .array(
      z.object({
        title: z.string(),
        /** What they should be able to do by the end. One sentence. */
        pupilOutcome: z.string(),
        /** Three to five things the lesson establishes, in order. */
        keyLearningPoints: z.array(z.string()),
        keywords: z.array(z.object({ keyword: z.string(), description: z.string() })),
      }),
    )
    .min(1)
    .max(10),
});

export const quizSchema = z.object({
  questions: z
    .array(
      z.object({
        type: z.enum(["MULTIPLE_CHOICE", "SHORT_ANSWER", "NUMERIC"]),
        prompt: z.string(),
        /** MULTIPLE_CHOICE: three or four choices, the correct one first. */
        choices: z.array(z.string()).nullable(),
        /** SHORT_ANSWER / NUMERIC: every answer a child might reasonably write. */
        acceptedAnswers: z.array(z.string()).nullable(),
        explanation: z.string(),
      }),
    )
    .min(4)
    .max(6),
});

function titleCase(slug: string): string {
  return SUBJECT_TITLES[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

function keyStageFor(yearGroup: number): string {
  if (yearGroup <= 2) return "ks1";
  if (yearGroup <= 6) return "ks2";
  if (yearGroup <= 9) return "ks3";
  return "ks4";
}

/**
 * Makes sure a subject-year has at least `wanted` lessons the child has not done.
 *
 * Returns the lessons it created. Safe to call repeatedly: it counts what is already there
 * first, and asks only for the shortfall.
 */
export async function generateLessons(
  subjectSlug: string,
  yearGroup: number,
  wanted: number,
  log: (line: string) => void = () => {},
): Promise<Lesson[]> {
  if (wanted <= 0) return [];

  /**
   * The subject the child's timetable already points at — not a new one.
   *
   * Subjects are unique per provider, so creating "maths" under our own provider makes a second
   * maths with a different id. The timetable points at the first one, the written lessons hang
   * off the second, and the planner matches subject ids: it looks straight past every lesson we
   * just wrote and schedules nothing. Reuse whatever already exists for this slug, and only
   * create one when the subject is genuinely new.
   */
  const subject =
    (await prisma.subject.findFirst({ where: { slug: subjectSlug }, orderBy: { createdAt: "asc" } })) ??
    (await prisma.subject.create({
      data: { provider: GENERATED_PROVIDER, slug: subjectSlug, title: titleCase(subjectSlug) },
    }));

  const programme = await prisma.programme.upsert({
    where: {
      provider_providerSlug: { provider: GENERATED_PROVIDER, providerSlug: `${subjectSlug}:${yearGroup}` },
    },
    create: {
      provider: GENERATED_PROVIDER,
      providerSlug: `${subjectSlug}:${yearGroup}`,
      subjectId: subject.id,
      yearGroup,
      keyStage: keyStageFor(yearGroup),
      title: `${titleCase(subjectSlug)} — Year ${yearGroup}`,
      syncedAt: new Date(),
    },
    update: { syncedAt: new Date() },
  });

  // What has already been written, so the next lessons continue rather than repeat.
  const existing = await prisma.lesson.findMany({
    where: { unit: { programmeId: programme.id } },
    orderBy: { order: "asc" },
    select: { title: true, order: true },
  });
  const nextOrder = existing.length > 0 ? Math.max(...existing.map((l) => l.order)) + 1 : 1;

  const ai = getAiProvider();
  const { data: sequence } = await ai.structured({
    model: "strong",
    schemaName: "lesson_sequence",
    schema: sequenceSchema,
    system: [
      `Plan the next ${wanted} lessons of ${titleCase(subjectSlug)} for a Year ${yearGroup} child in`,
      "England, following the national curriculum for that year.",
      "",
      "These are real lessons a child will sit down and do, one per 45-minute period, in the",
      "order given. Each must build on the one before it.",
      "",
      "Rules:",
      "- Pitch it at the year group. Year 4 is eight and nine year olds; Year 7 is eleven and twelve.",
      "- One idea per lesson. 'Fractions' is a unit; 'Finding equivalent fractions' is a lesson.",
      "- keyLearningPoints are what the lesson establishes, in the order it establishes them.",
      "- keywords are the words the lesson introduces, each defined in plain language a child of",
      "  this age would understand — not a dictionary definition.",
      "- pupilOutcome is what they can do at the end, stated so it could be checked.",
      "- Never repeat a lesson listed as already done below; carry on from where that left off.",
      "- UK English. No markdown.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content:
          existing.length > 0
            ? `Already done, in order:\n${existing.map((l) => `- ${l.title}`).join("\n")}\n\nPlan what comes next.`
            : `Nothing has been taught yet. Start at the beginning of Year ${yearGroup}.`,
      },
    ],
  });

  const unit = await prisma.unit.upsert({
    where: {
      programmeId_providerSlug: {
        programmeId: programme.id,
        providerSlug: `${subjectSlug}-${yearGroup}-${nextOrder}`,
      },
    },
    create: {
      provider: GENERATED_PROVIDER,
      providerSlug: `${subjectSlug}-${yearGroup}-${nextOrder}`,
      programmeId: programme.id,
      title: sequence.unitTitle,
      order: nextOrder,
      syncedAt: new Date(),
    },
    update: {},
  });

  const created: Lesson[] = [];
  for (const [i, spec] of sequence.lessons.slice(0, wanted).entries()) {
    const order = nextOrder + i;
    const lesson = await prisma.lesson
      .upsert({
        where: {
          provider_providerSlug: {
            provider: GENERATED_PROVIDER,
            providerSlug: `${subjectSlug}-${yearGroup}-l${order}`,
          },
        },
        create: {
          provider: GENERATED_PROVIDER,
          providerSlug: `${subjectSlug}-${yearGroup}-l${order}`,
          unitId: unit.id,
          title: spec.title,
          order,
          pupilOutcome: spec.pupilOutcome,
          keyLearningPoints: spec.keyLearningPoints,
          keywords: spec.keywords,
          estimatedMinutes: 45,
          licence: "OGL_COMPATIBLE",
          syncedAt: new Date(),
          // Nothing to fetch — there is no provider to ask, so this is settled, not pending.
          assetsSyncedAt: new Date(),
        },
        update: {},
      })
      .catch(() => null);
    if (!lesson) continue;

    const questions = await writeQuiz(lesson, subjectSlug, yearGroup).catch((err: unknown) => {
      log(`  Could not write the quiz for "${spec.title}": ${(err as Error).message}`);
      return 0;
    });
    log(`  ${spec.title} — ${questions} question(s)`);
    created.push(lesson);
  }

  return created;
}

/** The lesson's own quiz. Without it there is nothing to mark, and the lesson cannot be done. */
async function writeQuiz(lesson: Lesson, subjectSlug: string, yearGroup: number): Promise<number> {
  const already = await prisma.question.count({ where: { lessonId: lesson.id, stage: "CHECK" } });
  if (already > 0) return already;

  const points = Array.isArray(lesson.keyLearningPoints)
    ? (lesson.keyLearningPoints as unknown[]).filter((p): p is string => typeof p === "string")
    : [];

  const ai = getAiProvider();
  const { data } = await ai.structured({
    model: "strong",
    schemaName: "lesson_quiz",
    schema: quizSchema,
    system: [
      `Write the end-of-lesson quiz for a Year ${yearGroup} ${titleCase(subjectSlug)} lesson.`,
      "",
      "Rules:",
      "- Every question must be answerable from this lesson alone. Never assume anything taught",
      "  later, and never test general knowledge the lesson did not give them.",
      "- Build from the straightforward to something that needs the idea applied.",
      "- MULTIPLE_CHOICE: three or four choices, correct one FIRST, and wrong ones that a child",
      "  who half-understood would actually pick — not obviously silly.",
      "- SHORT_ANSWER and NUMERIC: list every answer a child might reasonably write, including",
      "  spellings and forms. Set choices to null for these.",
      "- Set acceptedAnswers to null for MULTIPLE_CHOICE.",
      "- explanation says why the answer is right, addressed to the child, in one or two sentences.",
      "- UK English. No markdown.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          `Lesson: ${lesson.title}`,
          lesson.pupilOutcome ? `They should be able to: ${lesson.pupilOutcome}` : "",
          points.length > 0 ? `\nWhat the lesson teaches:\n${points.map((p) => `- ${p}`).join("\n")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  let written = 0;
  for (const [i, q] of data.questions.entries()) {
    let options: unknown = null;
    let answerKey: unknown;

    if (q.type === "MULTIPLE_CHOICE") {
      const choices = (q.choices ?? []).map((text, idx) => ({ id: String.fromCharCode(97 + idx), text }));
      if (choices.length < 2) continue;
      const correctId = choices[0]!.id;
      // The model puts the right answer first; rotate so it is not always option a.
      const rotated = [...choices.slice(i % choices.length), ...choices.slice(0, i % choices.length)];
      options = { choices: rotated };
      answerKey = { correctOptionId: correctId };
    } else if (q.type === "NUMERIC") {
      const value = Number(String(q.acceptedAnswers?.[0] ?? "").replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(value)) continue;
      answerKey = { value, tolerance: 0, acceptedStrings: q.acceptedAnswers ?? [] };
    } else {
      answerKey = { accepted: q.acceptedAnswers ?? [], caseSensitive: false };
    }

    const row = await prisma.question
      .create({
        data: {
          lessonId: lesson.id,
          source: "AI_GENERATED",
          stage: "CHECK",
          order: i + 1,
          type: q.type,
          prompt: q.prompt,
          options: options as object,
          answerKey: answerKey as object,
          explanation: q.explanation,
          maxScore: 1,
          gradingMode: "DETERMINISTIC",
        },
      })
      .catch(() => null);
    if (row) written += 1;
  }
  return written;
}

/**
 * Makes sure this child is enrolled on the written programme for a subject.
 *
 * Only used when they have no programme for it at all — a child already on Oak's maths stays on
 * Oak's maths.
 */
export async function enrolOnGenerated(studentId: string, subjectId: string, yearGroup: number): Promise<void> {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) return;

  const programme = await prisma.programme.findUnique({
    where: {
      provider_providerSlug: { provider: GENERATED_PROVIDER, providerSlug: `${subject.slug}:${yearGroup}` },
    },
  });
  if (!programme) return;

  const already = await prisma.studentEnrolment.findFirst({
    where: { studentId, programmeId: programme.id },
  });
  if (already) return;

  await prisma.studentEnrolment
    .create({ data: { studentId, programmeId: programme.id, active: true } })
    .catch(() => undefined);
}
