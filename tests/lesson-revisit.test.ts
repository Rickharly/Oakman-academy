import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { recomputeLessonProgress } from "@/lib/progress/aggregate";

/**
 * Opening a lesson someone already finished must not un-finish it.
 *
 * "Review" from a subjects/progress card, or any lesson link once a lesson is done, starts a
 * fresh IN_PROGRESS `LessonAttempt` so the player has something to run on — but that attempt
 * starting used to flip the denormalised `StudentLessonProgress` row straight back to
 * IN_PROGRESS with a null mastery, which un-does the completion, gets the lesson re-planned, and
 * re-offers the pre-check, purely for having been opened.
 */
async function buildLesson() {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: `u${Math.random().toString(36).slice(2, 8)}`, passwordHash: "x", displayName: "Eva" },
  });
  const student = await prisma.studentProfile.create({ data: { userId: user.id, yearGroup: 7, keyStage: "ks3" } });
  const subject = await prisma.subject.create({ data: { provider: "test", slug: `s${Math.random()}`, title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { provider: "test", providerSlug: `p${Math.random()}`, subjectId: subject.id, yearGroup: 7, keyStage: "ks3", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { provider: "test", providerSlug: `u${Math.random()}`, programmeId: programme.id, title: "Unit", order: 1 },
  });
  const lesson = await prisma.lesson.create({
    data: { provider: "test", providerSlug: `l${Math.random()}`, unitId: unit.id, title: "Lesson", order: 1 },
  });
  return { studentId: student.id, lessonId: lesson.id };
}

describe("recomputeLessonProgress and a revisit of a done lesson", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("keeps a MASTERED progress row when a fresh attempt is opened on top of a finished one", async () => {
    const { studentId, lessonId } = await buildLesson();

    // The original, finished attempt — history, never touched again.
    await prisma.lessonAttempt.create({
      data: {
        studentId,
        lessonId,
        attemptNumber: 1,
        status: "MASTERED",
        currentStage: "COMPLETE",
        completedAt: new Date(),
        masteryScore: 0.95,
      },
    });
    await recomputeLessonProgress(studentId, lessonId);
    const before = await prisma.studentLessonProgress.findUniqueOrThrow({ where: { studentId_lessonId: { studentId, lessonId } } });
    expect(before.status).toBe("MASTERED");

    // "Review" opens the lesson again: a brand new IN_PROGRESS attempt, nothing answered yet.
    await prisma.lessonAttempt.create({
      data: { studentId, lessonId, attemptNumber: 2, status: "IN_PROGRESS", currentStage: "STARTER" },
    });
    const afterOpen = await recomputeLessonProgress(studentId, lessonId);

    expect(afterOpen.status).toBe("MASTERED");
    expect(afterOpen.mastery).toBeCloseTo(0.95, 5);
    expect(afterOpen.completedAt).not.toBeNull();
  });

  it("keeps a NEEDS_REVIEW progress row when the revisit is only just opened", async () => {
    const { studentId, lessonId } = await buildLesson();
    await prisma.lessonAttempt.create({
      data: {
        studentId,
        lessonId,
        attemptNumber: 1,
        status: "NEEDS_REVIEW",
        currentStage: "COMPLETE",
        completedAt: new Date(),
        masteryScore: 0.5,
      },
    });
    await recomputeLessonProgress(studentId, lessonId);

    await prisma.lessonAttempt.create({
      data: { studentId, lessonId, attemptNumber: 2, status: "IN_PROGRESS", currentStage: "STARTER" },
    });
    const progress = await recomputeLessonProgress(studentId, lessonId);
    expect(progress.status).toBe("NEEDS_REVIEW");
    expect(progress.needsReview).toBe(true);
  });

  it("still reports the fresh outcome once the revisit itself finishes", async () => {
    const { studentId, lessonId } = await buildLesson();
    await prisma.lessonAttempt.create({
      data: { studentId, lessonId, attemptNumber: 1, status: "COMPLETED", currentStage: "COMPLETE", completedAt: new Date(), masteryScore: 0.75 },
    });
    await recomputeLessonProgress(studentId, lessonId);

    const second = await prisma.lessonAttempt.create({
      data: { studentId, lessonId, attemptNumber: 2, status: "IN_PROGRESS", currentStage: "STARTER" },
    });
    await recomputeLessonProgress(studentId, lessonId); // just opened — still COMPLETED from attempt 1

    // The revisit actually finishes, this time scoring low enough for NEEDS_REVIEW.
    await prisma.lessonAttempt.update({
      where: { id: second.id },
      data: { status: "NEEDS_REVIEW", currentStage: "COMPLETE", completedAt: new Date(), masteryScore: 0.4 },
    });
    const progress = await recomputeLessonProgress(studentId, lessonId);
    expect(progress.status).toBe("NEEDS_REVIEW");
    expect(progress.mastery).toBeCloseTo(0.4, 5);
  });

  it("still reflects a genuine reset that mutates the one attempt row in place (parent override shape)", async () => {
    // handleReopenLesson / handleResetQuiz in admin/overrides.ts flip the SAME LessonAttempt row
    // back to IN_PROGRESS rather than creating a new one — that must still take effect.
    const { studentId, lessonId } = await buildLesson();
    const attempt = await prisma.lessonAttempt.create({
      data: { studentId, lessonId, attemptNumber: 1, status: "COMPLETED", currentStage: "COMPLETE", completedAt: new Date(), masteryScore: 0.8 },
    });
    await recomputeLessonProgress(studentId, lessonId);

    await prisma.lessonAttempt.update({
      where: { id: attempt.id },
      data: { status: "IN_PROGRESS", completedAt: null, currentStage: "CHECK" },
    });
    const progress = await recomputeLessonProgress(studentId, lessonId);
    expect(progress.status).toBe("IN_PROGRESS");
    expect(progress.completedAt).toBeNull();
  });
});
