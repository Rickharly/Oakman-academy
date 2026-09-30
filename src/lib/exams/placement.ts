/**
 * Finding out where a child actually is.
 *
 * Mikhael finishes everything put in front of him, quickly and correctly, which tells us only
 * that the work is too easy — never how much too easy. A child who never gets anything wrong is
 * not being taught, and we have no way of knowing whether he is a term ahead or two years.
 *
 * So: one paper, the same subject, at rising difficulty. It starts behind him with work he has
 * already done, moves to where the sequence says he is, then further along the year, then into
 * next year's programme. The score is not the point. The point is the band where he stops being
 * able to do it, because that is the level he should be taught at.
 *
 * Deliberately built to be failed. A placement paper that everyone passes has measured nothing,
 * and the child is told so up front so that getting stuck feels like the design rather than
 * like failing.
 */
import { prisma } from "@/lib/db";
import type { Exam, Question } from "@/generated/prisma/client";
import { isLessonDone } from "@/lib/progress/aggregate";

/** What each band means, in the order they are asked. */
export const BANDS: { band: number; label: string }[] = [
  { band: 0, label: "Work you have already done" },
  { band: 1, label: "Where you are now" },
  { band: 2, label: "Later this year" },
  { band: 3, label: "Next year's work" },
];

const PER_BAND = 4;

/** Questions a machine can mark without a conversation — an exam has no teacher in it. */
const MARKABLE = [
  "MULTIPLE_CHOICE",
  "MULTI_SELECT",
  "TRUE_FALSE",
  "NUMERIC",
  "SHORT_ANSWER",
  "MATCHING",
  "ORDERING",
] as const;

async function questionsForLessons(lessonIds: string[], take: number): Promise<Question[]> {
  if (lessonIds.length === 0) return [];
  const questions = await prisma.question.findMany({
    where: {
      lessonId: { in: lessonIds },
      excluded: false,
      stage: { in: ["CHECK", "PRACTICE"] },
      type: { in: [...MARKABLE] },
      source: { not: "AI_GENERATED" },
    },
    orderBy: [{ lessonId: "asc" }, { order: "asc" }],
  });

  // One per lesson first, so a band samples its range rather than one lesson of it.
  const byLesson = new Map<string, Question[]>();
  for (const q of questions) {
    if (!byLesson.has(q.lessonId)) byLesson.set(q.lessonId, []);
    byLesson.get(q.lessonId)!.push(q);
  }
  const picked: Question[] = [];
  for (let round = 0; picked.length < take && round < 3; round += 1) {
    for (const list of byLesson.values()) {
      if (picked.length >= take) break;
      if (list[round]) picked.push(list[round]);
    }
    if (![...byLesson.values()].some((l) => l[round])) break;
  }
  return picked;
}

/**
 * Builds the paper for one subject.
 *
 * Returns null when there is not enough material to make a real ladder — a placement paper made
 * of two questions measures nothing, and saying so is better than producing a number.
 */
export async function buildPlacementExam(
  studentId: string,
  subjectSlug: string,
): Promise<Exam | null> {
  const student = await prisma.studentProfile.findUnique({ where: { id: studentId } });
  if (!student) return null;

  const subject = await prisma.subject.findFirst({ where: { slug: subjectSlug } });
  if (!subject) return null;

  const thisYear = await prisma.programme.findFirst({
    where: { subjectId: subject.id, yearGroup: student.yearGroup, provider: { not: "fixture" } },
    include: { units: { include: { lessons: true }, orderBy: { order: "asc" } } },
  });
  if (!thisYear) return null;

  const nextYear = await prisma.programme.findFirst({
    where: { subjectId: subject.id, yearGroup: student.yearGroup + 1, provider: { not: "fixture" } },
    include: { units: { include: { lessons: true }, orderBy: { order: "asc" } } },
  });

  const sequence = thisYear.units.flatMap((u) =>
    [...u.lessons].sort((a, b) => a.order - b.order),
  );
  const progress = await prisma.studentLessonProgress.findMany({
    where: { studentId, lessonId: { in: sequence.map((l) => l.id) } },
  });
  const done = new Set(progress.filter(isLessonDone).map((p) => p.lessonId));

  /** Where the sequence thinks they are: the first thing they have not been through. */
  const position = sequence.findIndex((l) => !done.has(l.id));
  const at = position === -1 ? sequence.length : position;

  const behind = sequence.slice(0, at).map((l) => l.id);
  const here = sequence.slice(at, at + 4).map((l) => l.id);
  // Deliberately a jump, not the next few: "later this year" has to be genuinely harder or the
  // ladder has no rungs.
  const ahead = sequence.slice(at + 8, at + 16).map((l) => l.id);
  const nextYearLessons = (nextYear?.units ?? [])
    .flatMap((u) => u.lessons)
    .slice(0, 12)
    .map((l) => l.id);

  const bands: { band: number; lessonIds: string[] }[] = [
    { band: 0, lessonIds: behind },
    { band: 1, lessonIds: here },
    { band: 2, lessonIds: ahead },
    { band: 3, lessonIds: nextYearLessons },
  ];

  const chosen: { question: Question; band: number }[] = [];
  for (const { band, lessonIds } of bands) {
    const picks = await questionsForLessons(lessonIds, PER_BAND);
    for (const question of picks) chosen.push({ question, band });
  }

  // A ladder needs rungs. Two bands with anything in them is the least that means something.
  const bandsPresent = new Set(chosen.map((c) => c.band));
  if (bandsPresent.size < 2 || chosen.length < 6) return null;

  return prisma.exam.create({
    data: {
      studentId,
      kind: "PLACEMENT",
      title: `${subject.title}: finding your level`,
      coversFrom: null,
      coversTo: new Date(),
      questions: {
        create: chosen.map((c, i) => ({
          questionId: c.question.id,
          lessonId: c.question.lessonId,
          order: i,
          band: c.band,
          maxScore: c.question.maxScore,
        })),
      },
    },
  });
}

export interface BandResult {
  band: number;
  label: string;
  asked: number;
  right: number;
}

export interface PlacementVerdict {
  bands: BandResult[];
  /** The highest band they were solid on — two-thirds right or better. */
  solidTo: number;
  /** The first band they were not solid on. -1 when they were solid on all of them. */
  brokeAt: number;
  /** What a person should do about it, in one sentence. */
  recommendation: string;
}

/** Reads a marked placement paper as a level rather than as a score. */
export async function readPlacement(examId: string): Promise<PlacementVerdict> {
  const rows = await prisma.examQuestion.findMany({ where: { examId }, orderBy: { order: "asc" } });
  const exam = await prisma.exam.findUniqueOrThrow({
    where: { id: examId },
    include: { student: true },
  });

  const bands: BandResult[] = BANDS.map(({ band, label }) => {
    const inBand = rows.filter((r) => r.band === band);
    return {
      band,
      label,
      asked: inBand.length,
      right: inBand.filter((r) => r.isCorrect).length,
    };
  }).filter((b) => b.asked > 0);

  const solid = (b: BandResult) => b.right / b.asked >= 2 / 3;

  let solidTo = -1;
  let brokeAt = -1;
  for (const band of bands) {
    if (solid(band)) solidTo = band.band;
    else {
      brokeAt = band.band;
      break;
    }
  }

  const year = exam.student.yearGroup;
  const recommendation =
    brokeAt === -1
      ? `Solid on everything asked, including Year ${year + 1} material. Move them up a year in this subject — what they are being set now is not teaching them anything.`
      : brokeAt >= 3
        ? `Solid through the whole of Year ${year} and into next year's work. Push them further along the sequence; the current position is too far back.`
        : brokeAt === 2
          ? `Comfortable where they are and on later Year ${year} work. Skip ahead in the sequence rather than working through it in order.`
          : brokeAt === 1
            ? "About right where they are. The current position is the correct one."
            : "Struggling with work already covered. That is the thing to go back to, not the thing to push past.";

  return { bands, solidTo, brokeAt, recommendation };
}
