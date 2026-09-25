import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { runReviewAssignment, completeReview } from "@/lib/progress/review";
import { submitStage, completeStage } from "@/lib/lessons/service";

/**
 * A REVIEW assignment's stage must not reset to CHECK on every page render, and a settled
 * review must not be reopened into a second `completeReview` call over the same item.
 */
describe("running a REVIEW assignment", () => {
  let studentId: string;
  let lessonId: string;
  let assignmentId: string;
  let reviewItemId: string;
  let q1: string;

  beforeAll(async () => {
    await resetDb();
    const user = await prisma.user.create({
      data: { role: "STUDENT", username: "reviewer", passwordHash: "x", displayName: "Eva" },
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
        source: "OAK_EXIT_QUIZ",
        stage: "CHECK",
        order: 1,
        type: "MULTIPLE_CHOICE",
        prompt: "Question 1",
        options: { choices: [{ id: "a", text: "Correct" }, { id: "b", text: "Wrong" }] },
        answerKey: { correctOptionId: "a" },
        maxScore: 1,
      },
    });
    q1 = q.id;

    const reviewItem = await prisma.reviewItem.create({
      data: { studentId, lessonId, reason: "LOW_SCORE", status: "PENDING", dueAt: new Date() },
    });
    reviewItemId = reviewItem.id;

    const assignment = await prisma.dailyAssignment.create({
      data: {
        studentId,
        date: new Date(Date.UTC(2026, 8, 10)),
        order: 0,
        kind: "REVIEW",
        source: "REVIEW_ENGINE",
        subjectId: subject.id,
        lessonId,
        reviewItemId,
        estimatedMinutes: 15,
      },
    });
    assignmentId = assignment.id;
  });

  it("does not reset a graded CHECK back to CHECK on a later render", async () => {
    const attempt = await runReviewAssignment(assignmentId, studentId);
    expect(attempt.currentStage).toBe("CHECK");

    const { saveDraftAnswer } = await import("@/lib/lessons/service");
    await saveDraftAnswer(attempt.id, studentId, q1, { optionId: "a" });
    await submitStage(attempt.id, studentId, "CHECK");

    const afterSubmit = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(afterSubmit.currentStage).toBe("FEEDBACK");

    // A reload: /lessons/[id]?kind=REVIEW runs runReviewAssignment again.
    const reloaded = await runReviewAssignment(assignmentId, studentId);
    expect(reloaded.id).toBe(attempt.id);
    expect(reloaded.currentStage).toBe("FEEDBACK"); // not forced back to CHECK

    // Finishing still works normally.
    await completeStage(attempt.id, studentId, "FEEDBACK");
    const done = await completeStage(attempt.id, studentId, "COMPLETE");
    expect(done.status).not.toBe("IN_PROGRESS");
  });

  it("does not spawn a second SPACED review item when a settled review is reopened", async () => {
    // completeReview already ran once (from submitStage's CHECK hook) in the previous test.
    const before = await prisma.reviewItem.findUniqueOrThrow({ where: { id: reviewItemId } });
    expect(before.status).toBe("DONE");
    const spacedBefore = await prisma.reviewItem.count({ where: { studentId, reason: "SPACED" } });

    // Re-opening the same (now-completed) review assignment must not run the quiz again or
    // call completeReview a second time.
    const attempt = await runReviewAssignment(assignmentId, studentId);
    expect(attempt.currentStage).not.toBe("CHECK");

    // Even a direct second call to completeReview (defence in depth) must be a no-op.
    await completeReview(reviewItemId, 40);
    const spacedAfter = await prisma.reviewItem.count({ where: { studentId, reason: "SPACED" } });
    expect(spacedAfter).toBe(spacedBefore);
  });
});
