/**
 * The last line against "the maths lesson was the same".
 *
 * The planner already refuses to set a lesson that is done, or that teaches the same thing as
 * one that is done (`planner.ts`, `sameness.ts`). But a slot planned before the earlier lesson
 * was marked, a slot a parent placed by hand, a lesson finished on another row since the board
 * was drawn — any of them can still put yesterday's lesson in front of a child this morning,
 * and from where the child sits there is no difference between a planner bug and a planner
 * that was right an hour ago.
 *
 * So the check is made again at the door, when they open a lesson from today's board: if it
 * was finished on an earlier day, or teaches the same thing as one that was, the slot is
 * pointed at the next lesson that is new to them and they go straight there. Today's own work
 * is never touched — a lesson they started or finished today is the one they are in.
 */
import { prisma } from "@/lib/db";
import { isLessonDone } from "@/lib/progress/aggregate";
import { nextNewLesson, sameTeaching } from "@/lib/lessons/sameness";

/** Returns the lesson to send them to instead, or null when this one is right. */
export async function swapRepeatInSlot(
  studentId: string,
  lessonId: string,
  assignmentId: string,
  dayStart: Date,
): Promise<string | null> {
  const slot = await prisma.dailyAssignment.findFirst({
    where: {
      id: assignmentId,
      studentId,
      kind: "LESSON",
      lessonId,
      status: { in: ["PLANNED", "IN_PROGRESS"] },
    },
  });
  if (!slot) return null;

  // Already at it today: this is the lesson they are in, whatever happened before.
  const today = await prisma.lessonAttempt.count({ where: { studentId, lessonId, startedAt: { gte: dayStart } } });
  if (today > 0) return null;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { unit: { include: { programme: true } } },
  });
  if (!lesson) return null;

  const before = await prisma.studentLessonProgress.findMany({
    where: {
      studentId,
      completedAt: { lt: dayStart },
      lesson: { unit: { programme: { subjectId: lesson.unit.programme.subjectId } } },
    },
    select: {
      status: true,
      completedAt: true,
      lesson: { select: { id: true, title: true, keyLearningPoints: true } },
    },
  });
  const taught = before.filter(isLessonDone).map((p) => p.lesson);
  const repeat = taught.find((t) => t.id === lesson.id || sameTeaching(t, lesson));
  if (!repeat) return null;

  const next = await nextNewLesson(studentId, lessonId);
  if (!next) return null; // nothing new anywhere in the programme: better the repeat than nothing

  await prisma.dailyAssignment.update({ where: { id: slot.id }, data: { lessonId: next.id } });
  await prisma.activityLog.create({
    data: {
      studentId,
      kind: "repeat_lesson_swapped",
      data: { from: lesson.id, fromTitle: lesson.title, doneBefore: repeat.id, doneBeforeTitle: repeat.title, to: next.id, toTitle: next.title },
    },
  });
  return next.id;
}
