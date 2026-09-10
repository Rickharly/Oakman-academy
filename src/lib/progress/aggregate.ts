/**
 * Progress aggregation (spec §24–§27; ARCHITECTURE §8). `recomputeLessonProgress`
 * is the single writer of `StudentLessonProgress`; everything else here is a
 * read-side aggregation computed on demand.
 */
import { prisma } from "@/lib/db";
import type { AiLearningObservation, Lesson, StudentLessonProgress, Subject, Unit } from "@/generated/prisma/client";
import { addDaysKey, dateOnlyKey, toDateOnly, todayDateOnly, weekStartKey } from "@/lib/dates";

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pct(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/**
 * Whether a child has been through this lesson.
 *
 * Deliberately not "did well at it". A lesson finished below 70%, or with a gap the tutoring
 * loop parked for tomorrow, is saved as NEEDS_REVIEW — and counting only COMPLETED and MASTERED
 * meant that lesson showed as not done: a child who worked through every step, with everything
 * on the page green, watched the subject bar stay where it was. Whether they need to revisit it
 * is a separate question with its own answer (`needsReview`, and the review engine), and doing a
 * lesson imperfectly is still doing it.
 */
export function isLessonDone(row: { status: string; completedAt?: Date | null }): boolean {
  return row.status === "COMPLETED" || row.status === "MASTERED" || row.status === "NEEDS_REVIEW" || row.completedAt != null;
}

/**
 * Recomputes the denormalised `StudentLessonProgress` row for one student+lesson
 * from the current `LessonAttempt` history. Called after every graded activity
 * (via `afterActivityGraded`), on attempt creation, and on lesson completion.
 */
export async function recomputeLessonProgress(studentId: string, lessonId: string): Promise<StudentLessonProgress> {
  const attempts = await prisma.lessonAttempt.findMany({
    where: { studentId, lessonId },
    orderBy: { attemptNumber: "asc" },
  });

  if (attempts.length === 0) {
    return prisma.studentLessonProgress.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      create: { studentId, lessonId, status: "NOT_STARTED" },
      update: {},
    });
  }

  const latest = attempts[attempts.length - 1];
  const timeSpentSeconds = attempts.reduce((sum, a) => sum + a.timeSpentSeconds, 0);

  const checkActivities = await prisma.activityAttempt.findMany({
    where: { lessonAttempt: { studentId, lessonId }, stage: "CHECK", status: "GRADED" },
    orderBy: [{ lessonAttempt: { startedAt: "asc" } }, { attemptNumber: "asc" }],
  });
  const bestScorePct =
    checkActivities.length > 0
      ? Math.max(...checkActivities.map((a) => a.percentage ?? 0))
      : null;
  const latestCheckForLatestAttempt = await prisma.activityAttempt.findFirst({
    where: { lessonAttemptId: latest.id, stage: "CHECK", status: "GRADED" },
    orderBy: { attemptNumber: "desc" },
  });
  const latestScorePct = latestCheckForLatestAttempt?.percentage ?? (checkActivities.at(-1)?.percentage ?? null);

  return prisma.studentLessonProgress.upsert({
    where: { studentId_lessonId: { studentId, lessonId } },
    create: {
      studentId,
      lessonId,
      status: latest.status,
      attempts: attempts.length,
      bestScorePct,
      latestScorePct,
      mastery: latest.masteryScore,
      completedAt: latest.completedAt,
      lastActivityAt: new Date(),
      needsReview: latest.status === "NEEDS_REVIEW",
      timeSpentSeconds,
    },
    update: {
      status: latest.status,
      attempts: attempts.length,
      bestScorePct,
      latestScorePct,
      mastery: latest.masteryScore,
      completedAt: latest.completedAt,
      lastActivityAt: new Date(),
      needsReview: latest.status === "NEEDS_REVIEW",
      timeSpentSeconds,
    },
  });
}

export async function getStudentOverview(studentId: string): Promise<{
  today: { done: number; total: number };
  week: { done: number; total: number; pct: number };
  averageMastery: number | null;
  needsReview: number;
  completionPct: number;
}> {
  const todayKey = dateOnlyKey(todayDateOnly());
  const todayDate = toDateOnly(todayKey);

  const todayAssignments = await prisma.dailyAssignment.findMany({ where: { studentId, date: todayDate } });
  const todayActive = todayAssignments.filter((a) => a.status !== "MOVED");
  const today = { done: todayActive.filter((a) => a.status === "COMPLETED").length, total: todayActive.length };

  const weekStart = weekStartKey(todayKey);
  const weekDates = [0, 1, 2, 3, 4].map((i) => toDateOnly(addDaysKey(weekStart, i)));
  const weekAssignments = await prisma.dailyAssignment.findMany({ where: { studentId, date: { in: weekDates } } });
  const weekActive = weekAssignments.filter((a) => a.status !== "MOVED");
  const weekDone = weekActive.filter((a) => a.status === "COMPLETED").length;
  const week = { done: weekDone, total: weekActive.length, pct: pct(weekDone, weekActive.length) };

  const progressRows = await prisma.studentLessonProgress.findMany({ where: { studentId } });
  const masteryVals = progressRows.map((p) => p.mastery).filter((m): m is number => m != null);
  const averageMastery = mean(masteryVals);

  const needsReview = await prisma.reviewItem.count({ where: { studentId, status: { in: ["PENDING", "SCHEDULED"] } } });

  const enrolments = await prisma.studentEnrolment.findMany({ where: { studentId, active: true } });
  const totalLessons = enrolments.length
    ? await prisma.lesson.count({ where: { unit: { programmeId: { in: enrolments.map((e) => e.programmeId) } } } })
    : 0;
  const completedLessons = progressRows.filter(isLessonDone).length;
  const completionPct = pct(completedLessons, totalLessons);

  return { today, week, averageMastery, needsReview, completionPct };
}

export async function getSubjectProgress(studentId: string): Promise<
  { subject: Subject; programmeId: string; completionPct: number; mastery: number | null; lessonsDone: number; lessonsTotal: number }[]
> {
  const enrolments = await prisma.studentEnrolment.findMany({
    where: { studentId, active: true },
    include: { programme: { include: { subject: true } } },
  });

  const results: { subject: Subject; programmeId: string; completionPct: number; mastery: number | null; lessonsDone: number; lessonsTotal: number }[] = [];

  for (const enrolment of enrolments) {
    const lessons = await prisma.lesson.findMany({ where: { unit: { programmeId: enrolment.programmeId } }, select: { id: true } });
    const lessonIds = lessons.map((l) => l.id);
    const progressRows = lessonIds.length
      ? await prisma.studentLessonProgress.findMany({ where: { studentId, lessonId: { in: lessonIds } } })
      : [];
    const lessonsDone = progressRows.filter(isLessonDone).length;
    const mastery = mean(progressRows.map((p) => p.mastery).filter((m): m is number => m != null));

    results.push({
      subject: enrolment.programme.subject,
      programmeId: enrolment.programmeId,
      completionPct: pct(lessonsDone, lessons.length),
      mastery,
      lessonsDone,
      lessonsTotal: lessons.length,
    });
  }

  return results;
}

export async function getUnitProgress(
  studentId: string,
  programmeId: string
): Promise<{ unit: Unit; lessonsDone: number; lessonsTotal: number; mastery: number | null; lessons: (Lesson & { progress: StudentLessonProgress | null })[] }[]> {
  const units = await prisma.unit.findMany({
    where: { programmeId },
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" } } },
  });

  const lessonIds = units.flatMap((u) => u.lessons.map((l) => l.id));
  const progressRows = lessonIds.length
    ? await prisma.studentLessonProgress.findMany({ where: { studentId, lessonId: { in: lessonIds } } })
    : [];
  const progressByLesson = new Map(progressRows.map((p) => [p.lessonId, p]));

  return units.map((unit) => {
    const lessons = unit.lessons.map((l) => ({ ...l, progress: progressByLesson.get(l.id) ?? null }));
    const lessonsDone = lessons.filter((l) => l.progress && isLessonDone(l.progress)).length;
    const mastery = mean(lessons.map((l) => l.progress?.mastery).filter((m): m is number => m != null));
    return { unit, lessonsDone, lessonsTotal: unit.lessons.length, mastery, lessons };
  });
}

export async function getWeakTopics(
  studentId: string,
  limit = 5
): Promise<{ lesson: Lesson; subject: Subject; mastery: number; observations: AiLearningObservation[] }[]> {
  const progressRows = await prisma.studentLessonProgress.findMany({
    where: { studentId, mastery: { not: null } },
    orderBy: { mastery: "asc" },
    take: limit,
    include: { lesson: { include: { unit: { include: { programme: { include: { subject: true } } } } } } },
  });

  const results: { lesson: Lesson; subject: Subject; mastery: number; observations: AiLearningObservation[] }[] = [];
  for (const p of progressRows) {
    const observations = await prisma.aiLearningObservation.findMany({
      where: { studentId, lessonId: p.lessonId, active: true },
      orderBy: { lastSeenAt: "desc" },
      take: 5,
    });
    results.push({ lesson: p.lesson, subject: p.lesson.unit.programme.subject, mastery: p.mastery ?? 0, observations });
  }
  return results;
}
