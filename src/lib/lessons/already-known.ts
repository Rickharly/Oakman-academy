/**
 * "I've already learned this."
 *
 * A child who is set a lesson they have already sat through has two bad options: do it again,
 * or argue with a parent who cannot check. Both of those cost a morning, and the app is the one
 * that got it wrong. So they can say so, in one tap, and move on with their day.
 *
 * It is a claim, not a mark. Nothing about it pretends they were assessed: no score, no mastery,
 * no completed attempt. It stops the lesson coming round again and it is reported for a person
 * to check — with the evidence gathered here, so whoever reads it can tell a genuine repeat from
 * a child dodging a lesson without having to go digging.
 *
 * That evidence matters both ways. If they have done a lesson with this title before, the
 * planner has a bug and I want to know today. If they have not, a parent should know that too.
 */
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth/api";
import { reportAlreadyKnown } from "@/lib/admin/report-to-github";

export interface AlreadyKnownResult {
  /** True when we can see them finishing a lesson of the same name before. */
  seenBefore: boolean;
  /** What we found, in a sentence, for the child and the parent. */
  message: string;
}

export async function markAlreadyLearned(
  studentId: string,
  lessonId: string,
  opts: { assignmentId?: string | null; note?: string | null } = {},
): Promise<AlreadyKnownResult> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { unit: { include: { programme: { include: { subject: true } } } } },
  });
  if (!lesson) throw new ApiError(404, "Lesson not found");

  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: { user: { select: { displayName: true } } },
  });
  if (!student) throw new ApiError(404, "Student not found");

  /**
   * Have they actually met this before?
   *
   * By title as well as by id, because the repeat that started all this was the same lesson
   * arriving as a different row — the placeholder curriculum's copy and Oak's copy of the same
   * lesson are two different ids with one name.
   */
  const earlier = await prisma.studentLessonProgress.findMany({
    where: {
      studentId,
      lesson: { title: lesson.title },
      NOT: { lessonId },
      status: { in: ["COMPLETED", "MASTERED", "NEEDS_REVIEW"] },
    },
    include: { lesson: { select: { title: true } } },
    take: 5,
  });
  const sameLesson = await prisma.studentLessonProgress.findUnique({
    where: { studentId_lessonId: { studentId, lessonId } },
  });
  const seenBefore = earlier.length > 0 || Boolean(sameLesson?.completedAt);

  // The claim itself. No score and no mastery: we did not watch them do it, and writing a mark
  // we did not measure would be a lie in their record.
  await prisma.studentLessonProgress.upsert({
    where: { studentId_lessonId: { studentId, lessonId } },
    create: {
      studentId,
      lessonId,
      status: "ALREADY_KNOWN",
      completedAt: new Date(),
      lastActivityAt: new Date(),
    },
    update: {
      // A lesson they genuinely worked through keeps that history — this never overwrites a
      // real result with a claim.
      status: sameLesson?.completedAt ? sameLesson.status : "ALREADY_KNOWN",
      completedAt: sameLesson?.completedAt ?? new Date(),
      lastActivityAt: new Date(),
    },
  });

  // The day moves on. SKIPPED rather than COMPLETED, because they did not do it.
  if (opts.assignmentId) {
    await prisma.dailyAssignment
      .updateMany({
        where: { id: opts.assignmentId, studentId, status: { in: ["PLANNED", "IN_PROGRESS"] } },
        data: { status: "SKIPPED", completedAt: new Date() },
      })
      .catch(() => undefined);
  }

  await prisma.activityLog.create({
    data: {
      studentId,
      kind: "lesson_already_known",
      data: {
        lessonId,
        lessonTitle: lesson.title,
        subject: lesson.unit.programme.subject.title,
        note: opts.note ?? null,
        seenBefore,
        earlierLessonIds: earlier.map((e) => e.lessonId),
      },
    },
  });

  // Sent, not awaited on the child's behalf: a report that will not send must never leave a
  // child stuck on a lesson they say they have done.
  void reportAlreadyKnown({
    studentName: student.user.displayName,
    yearGroup: student.yearGroup,
    lessonTitle: lesson.title,
    subject: lesson.unit.programme.subject.title,
    unitTitle: lesson.unit.title,
    note: opts.note ?? null,
    seenBefore,
    earlierTitles: earlier.map((e) => e.lesson.title),
  }).catch(() => undefined);

  return {
    seenBefore,
    message: seenBefore
      ? "You're right — you have done this one before. I've taken it off your day and I'll find out why it came back."
      : "Alright, I've taken it off your day and told your teacher, who will have a look.",
  };
}
