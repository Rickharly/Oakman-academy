/**
 * A parent moving their child on to the next lesson, now.
 *
 * "Can you just move him to the next lesson right now? Or give me a setting where I can just
 * click a new lesson for him." Whatever the app thinks, the parent sitting next to the child
 * knows whether a lesson is done. This closes the lesson the child is on and points today's
 * period at the next lesson that is new to them (`markAlreadyLearned`, the same move as the
 * child's own "I've already learned this", noted as the parent's). The child's open lesson
 * checks in every few seconds and follows (`LessonPlayer`, `/api/attempts/[id]/state`).
 */
import { prisma } from "@/lib/db";
import { schoolDayKey, toDateOnly } from "@/lib/dates";
import { markAlreadyLearned } from "@/lib/lessons/already-known";

export interface MoveResult {
  moved: boolean;
  fromTitle: string | null;
  toTitle: string | null;
  message: string;
}

export async function moveToNextLesson(studentId: string): Promise<MoveResult> {
  const today = toDateOnly(schoolDayKey());

  // Where they are: the lesson they have open, else the first unfinished period today.
  const open = await prisma.lessonAttempt.findFirst({
    where: { studentId, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
    include: { lesson: { include: { unit: { include: { programme: true } } } } },
  });
  const slotWith = (status: "IN_PROGRESS" | "PLANNED") =>
    prisma.dailyAssignment.findFirst({
      where: { studentId, date: today, kind: "LESSON", status, lessonId: { not: null } },
      orderBy: { order: "asc" },
      include: { lesson: true },
    });
  const firstSlot = (await slotWith("IN_PROGRESS")) ?? (await slotWith("PLANNED"));

  const lessonId = open?.lessonId ?? firstSlot?.lessonId ?? null;
  if (!lessonId) {
    return { moved: false, fromTitle: null, toTitle: null, message: "There's no lesson open or waiting today to move on from." };
  }
  const fromTitle = open?.lesson.title ?? firstSlot?.lesson?.title ?? null;

  // Today's period for that subject, so the board and the clock follow the move.
  const subjectId = open?.lesson.unit.programme.subjectId ?? firstSlot?.subjectId ?? null;
  const slot = await prisma.dailyAssignment.findFirst({
    where: {
      studentId,
      date: today,
      kind: "LESSON",
      status: { in: ["IN_PROGRESS", "PLANNED"] },
      ...(subjectId ? { subjectId } : { lessonId }),
    },
    orderBy: { order: "asc" },
  });

  const result = await markAlreadyLearned(studentId, lessonId, {
    assignmentId: slot?.id ?? open?.assignmentId ?? null,
    note: "Moved on to the next lesson by a parent.",
  });

  await prisma.activityLog.create({
    data: {
      studentId,
      kind: "parent_moved_to_next_lesson",
      data: { fromLessonId: lessonId, fromTitle, toLessonId: result.nextLessonId, toTitle: result.nextLessonTitle },
    },
  });

  return {
    moved: Boolean(result.nextLessonId),
    fromTitle,
    toTitle: result.nextLessonTitle,
    message: result.nextLessonTitle
      ? `Done. "${fromTitle}" is closed and "${result.nextLessonTitle}" is next. The lesson on their screen switches over within about 20 seconds.`
      : `"${fromTitle}" is closed. There was no new lesson left in that subject, so they go on to the next period.`,
  };
}

/**
 * Ends the period the child is in, now — the parent's override of the clock.
 *
 * Today's open lesson periods are marked done, so nothing holds the child on the lesson and
 * Today goes on to the next period. The lesson itself is not touched: if it was not finished,
 * it carries over like any other unfinished lesson.
 */
export async function endPeriodNow(studentId: string): Promise<MoveResult> {
  const today = toDateOnly(schoolDayKey());
  const open = await prisma.dailyAssignment.findMany({
    where: { studentId, date: today, kind: "LESSON", status: "IN_PROGRESS" },
    include: { lesson: { select: { title: true } } },
  });
  if (open.length === 0) {
    return { moved: false, fromTitle: null, toTitle: null, message: "No period is running right now." };
  }
  await prisma.dailyAssignment.updateMany({
    where: { id: { in: open.map((a) => a.id) } },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  await prisma.activityLog.create({
    data: { studentId, kind: "parent_ended_period", data: { assignmentIds: open.map((a) => a.id) } },
  });
  const fromTitle = open[0]?.lesson?.title ?? null;
  return {
    moved: true,
    fromTitle,
    toTitle: null,
    message: "Done. This period is over; the next period starts from Today.",
  };
}
