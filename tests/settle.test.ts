import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { completeStage, settleFinishedLessons } from "@/lib/lessons/service";

/**
 * A lesson someone actually did should be on the board as done.
 *
 * A child answered every question, scored full marks, and her board still said the lesson had
 * not been started — because the only thing that finished a lesson was a button, and that
 * button was hidden whenever there was time left in the period. Bookkeeping must not be able
 * to un-do a lesson someone did.
 */
const MINUTES = 60 * 1000;

async function buildAttempt(opts: { gradedMinutesAgo: number | null }) {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: `s${Math.random().toString(36).slice(2, 8)}`, passwordHash: "x", displayName: "Eva" },
  });
  const student = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 7, keyStage: "ks3" },
  });
  const subject = await prisma.subject.create({ data: { provider: "test", slug: `s${Math.random()}`, title: "Maths" } });
  const programme = await prisma.programme.create({
    data: {
      provider: "test",
      providerSlug: `p${Math.random()}`,
      subjectId: subject.id,
      yearGroup: 7,
      keyStage: "ks3",
      title: "Maths",
    },
  });
  const unit = await prisma.unit.create({
    data: { provider: "test", providerSlug: `u${Math.random()}`, programmeId: programme.id, title: "Unit", order: 1 },
  });
  const lesson = await prisma.lesson.create({
    data: { provider: "test", providerSlug: `l${Math.random()}`, unitId: unit.id, title: "Lesson", order: 1 },
  });
  const assignment = await prisma.dailyAssignment.create({
    data: {
      studentId: student.id,
      date: new Date(Date.UTC(2026, 8, 8)),
      order: 1,
      kind: "LESSON",
      subjectId: subject.id,
      lessonId: lesson.id,
      estimatedMinutes: 45,
      source: "AUTO",
    },
  });
  const attempt = await prisma.lessonAttempt.create({
    data: {
      studentId: student.id,
      lessonId: lesson.id,
      assignmentId: assignment.id,
      attemptNumber: 1,
      currentStage: "FEEDBACK",
      masteryScore: 1,
    },
  });
  if (opts.gradedMinutesAgo !== null) {
    await prisma.activityAttempt.create({
      data: {
        lessonAttemptId: attempt.id,
        stage: "CHECK",
        attemptNumber: 1,
        status: "GRADED",
        gradedAt: new Date(Date.now() - opts.gradedMinutesAgo * MINUTES),
        score: 4,
        maxScore: 4,
        percentage: 100,
      },
    });
  }
  return { studentId: student.id, attemptId: attempt.id, assignmentId: assignment.id, lessonId: lesson.id };
}

describe("a lesson finished but never signed off", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("marks it done, and marks the day's assignment done with it", async () => {
    const { studentId, attemptId, assignmentId } = await buildAttempt({ gradedMinutesAgo: 30 });

    expect(await settleFinishedLessons(studentId)).toBe(1);

    const attempt = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(attempt.status).toBe("COMPLETED");
    expect(attempt.completedAt).not.toBeNull();
    expect(attempt.currentStage).toBe("COMPLETE");

    // The board reads the assignment, so this is the bit the child actually sees.
    const assignment = await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    expect(assignment.status).toBe("COMPLETED");
  });

  it("leaves a lesson still being worked on alone", async () => {
    // Marked two minutes ago: she may be reading her feedback, retrying a question, or doing
    // the extra practice. Closing the lesson under her would be worse than the bug.
    const { studentId, attemptId } = await buildAttempt({ gradedMinutesAgo: 2 });

    expect(await settleFinishedLessons(studentId)).toBe(0);
    const attempt = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(attempt.status).toBe("IN_PROGRESS");
  });

  it("leaves a lesson whose quiz was never marked alone", async () => {
    // Opened and abandoned is not finished. Only a marked quiz counts as the work being done.
    const { studentId, attemptId } = await buildAttempt({ gradedMinutesAgo: null });

    expect(await settleFinishedLessons(studentId)).toBe(0);
    const attempt = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(attempt.status).toBe("IN_PROGRESS");
  });
});

describe("pressing Finish", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("works from whichever step the record thinks they are on", async () => {
    // The player used to send two requests — leave FEEDBACK, then COMPLETE — and each was
    // refused unless the record already agreed about the stage. When it did not, the child got
    // "Stage mismatch" over a lesson they had just done with every step green.
    const { studentId, attemptId, assignmentId, lessonId } = await buildAttempt({ gradedMinutesAgo: 1 });
    await prisma.lessonAttempt.update({ where: { id: attemptId }, data: { currentStage: "CHECK" } });

    const done = await completeStage(attemptId, studentId, "COMPLETE");
    expect(done.status).toBe("COMPLETED");

    const assignment = await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    expect(assignment.status).toBe("COMPLETED");

    const progress = await prisma.studentLessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId, lessonId } },
    });
    expect(progress.completedAt).not.toBeNull();
  });

  it("is safe to press twice", async () => {
    const { studentId, attemptId } = await buildAttempt({ gradedMinutesAgo: 1 });

    await completeStage(attemptId, studentId, "COMPLETE");
    // A second press — a double tap, a slow connection, a retry — is not an error to show a
    // child over a lesson that is already finished.
    const again = await completeStage(attemptId, studentId, "COMPLETE");
    expect(again.status).toBe("COMPLETED");
  });

  it("refuses only when the quiz has genuinely not been marked", async () => {
    const { studentId, attemptId } = await buildAttempt({ gradedMinutesAgo: null });
    await expect(completeStage(attemptId, studentId, "COMPLETE")).rejects.toThrow();
  });
});
