import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { startOrResumeAttempt, saveDraftAnswer, submitStage, completeStage } from "@/lib/lessons/service";

/**
 * `submitStage` on a stage with zero visible questions used to always create a fresh
 * `ActivityAttempt` with `attemptNumber: 1`. When one already existed for that stage — a
 * PRACTICE round another route already graded, or a stage whose only question was excluded
 * after the child had already started answering it — that collided with the unique
 * `(lessonAttemptId, stage, attemptNumber)` index and 500'd instead of letting the lesson move
 * on.
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

describe("submitStage with zero visible questions but an activity already on the books", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("reuses an existing GRADED PRACTICE activity instead of colliding on attemptNumber", async () => {
    const { studentId, lessonId } = await buildLesson();
    const attempt = await startOrResumeAttempt(studentId, lessonId);
    await prisma.lessonAttempt.update({ where: { id: attempt.id }, data: { currentStage: "PRACTICE" } });

    // Stands in for what /practice/submit would have created: a PRACTICE round already graded,
    // with no PRACTICE `Question` rows existing in this lesson at all (so `submitStage` sees
    // zero visible questions for the stage).
    await prisma.activityAttempt.create({
      data: {
        lessonAttemptId: attempt.id,
        stage: "PRACTICE",
        attemptNumber: 1,
        status: "GRADED",
        submittedAt: new Date(),
        gradedAt: new Date(),
        score: 3,
        maxScore: 4,
        percentage: 75,
      },
    });

    const { activity, results } = await submitStage(attempt.id, studentId, "PRACTICE");
    expect(results).toHaveLength(0);
    expect(activity.status).toBe("GRADED");
    // The already-graded score is left exactly as it was — this call had nothing to grade.
    expect(activity.score).toBe(3);
    expect(activity.maxScore).toBe(4);

    const afterAttempt = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(afterAttempt.currentStage).toBe("CHECK");

    const activities = await prisma.activityAttempt.count({ where: { lessonAttemptId: attempt.id, stage: "PRACTICE" } });
    expect(activities).toBe(1); // no duplicate / colliding row
  });

  it("reuses an existing IN_PROGRESS activity (its only question was excluded) and grades it as empty", async () => {
    const { studentId, lessonId } = await buildLesson();
    const question = await prisma.question.create({
      data: {
        lessonId,
        source: "OAK_WORKSHEET",
        stage: "PRACTICE",
        order: 1,
        type: "NUMERIC",
        prompt: "2 + 2",
        answerKey: { value: 4, tolerance: 0 },
        maxScore: 1,
      },
    });

    const attempt = await startOrResumeAttempt(studentId, lessonId);
    await prisma.lessonAttempt.update({ where: { id: attempt.id }, data: { currentStage: "PRACTICE" } });
    await saveDraftAnswer(attempt.id, studentId, question.id, { text: "4" });

    // A parent excludes the only question in the stage after the draft was saved.
    await prisma.question.update({ where: { id: question.id }, data: { excluded: true } });

    const { activity, results } = await submitStage(attempt.id, studentId, "PRACTICE");
    expect(results).toHaveLength(0);
    expect(activity.status).toBe("GRADED");

    const count = await prisma.activityAttempt.count({ where: { lessonAttemptId: attempt.id, stage: "PRACTICE" } });
    expect(count).toBe(1); // the existing IN_PROGRESS row was reused, not duplicated

    // The lesson keeps moving — proof this did not 500.
    const afterAttempt = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(afterAttempt.currentStage).toBe("CHECK");
    await prisma.lessonAttempt.update({ where: { id: attempt.id }, data: { currentStage: "CHECK" } });
    await submitStage(attempt.id, studentId, "CHECK");
    await completeStage(attempt.id, studentId, "FEEDBACK");
    const done = await completeStage(attempt.id, studentId, "COMPLETE");
    expect(done.status).not.toBe("IN_PROGRESS");
  });
});
