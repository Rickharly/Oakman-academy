import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { startOrResumeAttempt, saveDraftAnswer, submitStage } from "@/lib/lessons/service";
import { ApiError } from "@/lib/auth/api";

/**
 * A draft save on a stage that is already graded, with no retry requested, must not open a
 * fresh empty round.
 *
 * A client-side renderer firing an answer's onChange on mount after a reload was enough to
 * trigger this: the stage's score went blank, and a resubmit zeroed out marks the child had
 * already earned. Only `retryQuestion` may legitimately reopen a graded activity.
 */
describe("saving a draft on an already-graded stage", () => {
  let studentId: string;
  let lessonId: string;
  let q1: string;

  beforeAll(async () => {
    await resetDb();
    const user = await prisma.user.create({
      data: { role: "STUDENT", username: "drafter", passwordHash: "x", displayName: "Eva" },
    });
    const student = await prisma.studentProfile.create({ data: { userId: user.id, yearGroup: 7, keyStage: "ks3" } });
    studentId = student.id;
    const subject = await prisma.subject.create({ data: { provider: "test", slug: "maths", title: "Maths" } });
    const programme = await prisma.programme.create({
      data: { provider: "test", providerSlug: "m7", subjectId: subject.id, yearGroup: 7, keyStage: "ks3", title: "Maths" },
    });
    const unit = await prisma.unit.create({
      data: { provider: "test", providerSlug: "u1", programmeId: programme.id, title: "Unit", order: 1 },
    });
    const lesson = await prisma.lesson.create({
      data: { provider: "test", providerSlug: "l1", unitId: unit.id, title: "Lesson", order: 1 },
    });
    lessonId = lesson.id;
    const q = await prisma.question.create({
      data: {
        lessonId,
        source: "OAK_STARTER_QUIZ",
        stage: "STARTER",
        order: 1,
        type: "MULTIPLE_CHOICE",
        prompt: "1 + 1?",
        options: { choices: [{ id: "a", text: "2" }, { id: "b", text: "3" }] },
        answerKey: { correctOptionId: "a" },
        maxScore: 1,
      },
    });
    q1 = q.id;
  });

  it("refuses instead of spawning a new round, and leaves the graded score untouched", async () => {
    const attempt = await startOrResumeAttempt(studentId, lessonId);
    await saveDraftAnswer(attempt.id, studentId, q1, { optionId: "a" });
    const graded = await submitStage(attempt.id, studentId, "STARTER");
    expect(graded.activity.status).toBe("GRADED");
    expect(graded.activity.score).toBe(1);

    // Simulate the stray onChange: a draft save on the now-graded STARTER stage with no retry
    // ever requested.
    await expect(saveDraftAnswer(attempt.id, studentId, q1, { optionId: "b" })).rejects.toThrow(ApiError);

    const activityCount = await prisma.activityAttempt.count({ where: { lessonAttemptId: attempt.id, stage: "STARTER" } });
    expect(activityCount).toBe(1); // no new round was opened

    const activity = await prisma.activityAttempt.findFirstOrThrow({ where: { lessonAttemptId: attempt.id, stage: "STARTER" } });
    expect(activity.status).toBe("GRADED");
    expect(activity.score).toBe(1); // untouched

    const q1Attempt = await prisma.questionAttempt.findFirstOrThrow({ where: { questionId: q1 } });
    expect(q1Attempt.isCorrect).toBe(true); // the graded answer was never overwritten
  });
});
