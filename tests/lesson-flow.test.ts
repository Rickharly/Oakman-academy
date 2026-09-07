import { beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";

// The grading/ai modules are owned by other engineers and may not exist yet in
// this tree; the lesson flow imports them by contract (docs/CONTRACTS.md), so
// we mock the AI boundary here with simple deterministic fakes.
vi.mock("@/lib/ai/teacher-agent", () => ({
  teacherAgent: {
    chat: vi.fn(),
    grade: vi.fn(async ({ response }: { response: { text?: string } }) => {
      const text = (response?.text ?? "").trim();
      const correct = text.length > 0;
      return {
        score: correct ? 2 : 0,
        maxScore: 2,
        correct,
        mastery: correct ? 0.9 : 0,
        feedbackForStudent: correct ? "Nice explanation." : "Try writing an answer.",
        reasoningForParent: "AI-graded extended text (mock).",
        misconceptions: correct ? [] : ["did not attempt the question"],
        needsReview: !correct,
        raw: { mock: true },
        model: "mock-model",
      };
    }),
    summarizeLesson: vi.fn(async () => ({
      forStudent: "Great work today — you're getting the hang of this!",
      forParent: "She worked through fractions confidently, with one wobble on the check quiz.",
      misconceptions: [],
    })),
    summarizeDay: vi.fn(),
    generatePractice: vi.fn(),
    identifyMisconceptions: vi.fn(async () => []),
  },
  teacherModeForStage: (stage: string) => {
    if (stage === "PRACTICE") return "PRACTICE";
    if (stage === "CHECK") return "ASSESSMENT";
    return "LEARN";
  },
}));

const { startOrResumeAttempt, getAttemptView, saveDraftAnswer, submitStage, retryQuestion, completeStage } = await import(
  "@/lib/lessons/service"
);

describe("lesson flow", () => {
  let studentId: string;
  let lessonId: string;
  let starterQ1: string;
  let starterQ2: string;
  let practiceNumeric: string;
  let practiceExtended: string;
  let checkQ1: string;
  let checkQ2: string;
  let checkQ3: string;
  let assignmentId: string;

  beforeAll(async () => {
    await resetDb();

    const parentUser = await prisma.user.create({
      data: { role: "PARENT", email: "parent@example.com", passwordHash: "x", displayName: "Parent" },
    });
    const studentUser = await prisma.user.create({
      data: { role: "STUDENT", username: "eva", passwordHash: "x", displayName: "Eva" },
    });
    await prisma.parentStudentLink.create({ data: { parentId: parentUser.id, studentId: studentUser.id } });
    const student = await prisma.studentProfile.create({
      data: { userId: studentUser.id, yearGroup: 7, keyStage: "ks3" },
    });
    studentId = student.id;

    const subject = await prisma.subject.create({ data: { slug: "maths", title: "Maths" } });
    const programme = await prisma.programme.create({
      data: {
        providerSlug: "test-maths:7",
        subjectId: subject.id,
        yearGroup: 7,
        keyStage: "ks3",
        title: "Maths — Year 7",
      },
    });
    await prisma.studentEnrolment.create({ data: { studentId, programmeId: programme.id } });
    const unit = await prisma.unit.create({
      data: { providerSlug: "fractions", programmeId: programme.id, title: "Fractions", order: 1 },
    });
    const lesson = await prisma.lesson.create({
      data: {
        providerSlug: "adding-fractions",
        unitId: unit.id,
        title: "Adding fractions",
        order: 1,
        estimatedMinutes: 50,
        keyLearningPoints: ["Find a common denominator", "Add the numerators"],
        misconceptions: [{ misconception: "Adding denominators", response: "Denominators must match first." }],
      },
    });
    lessonId = lesson.id;

    const starter1 = await prisma.question.create({
      data: {
        lessonId,
        source: "OAK_STARTER_QUIZ",
        stage: "STARTER",
        order: 1,
        type: "MULTIPLE_CHOICE",
        prompt: "What is 1/2 + 1/2?",
        options: { choices: [{ id: "a", text: "1" }, { id: "b", text: "2" }] },
        answerKey: { correctOptionId: "a" },
        maxScore: 1,
      },
    });
    starterQ1 = starter1.id;
    const starter2 = await prisma.question.create({
      data: {
        lessonId,
        source: "OAK_STARTER_QUIZ",
        stage: "STARTER",
        order: 2,
        type: "MULTIPLE_CHOICE",
        prompt: "What is 1/4 + 1/4?",
        options: { choices: [{ id: "a", text: "1/2" }, { id: "b", text: "2/4" }] },
        answerKey: { correctOptionId: "a" },
        maxScore: 1,
      },
    });
    starterQ2 = starter2.id;

    const numeric = await prisma.question.create({
      data: {
        lessonId,
        source: "OAK_WORKSHEET",
        stage: "PRACTICE",
        order: 1,
        type: "NUMERIC",
        prompt: "1/4 + 1/4 = ?",
        answerKey: { value: 0.5, tolerance: 0 },
        maxScore: 1,
      },
    });
    practiceNumeric = numeric.id;
    const extended = await prisma.question.create({
      data: {
        lessonId,
        source: "OAK_WORKSHEET",
        stage: "PRACTICE",
        order: 2,
        type: "EXTENDED_TEXT",
        prompt: "Explain why you need a common denominator to add fractions.",
        answerKey: { modelAnswer: "Because you can only add like parts." },
        maxScore: 2,
        gradingMode: "AI",
      },
    });
    practiceExtended = extended.id;

    for (const [i, correctId] of ["a", "a", "a"].entries()) {
      const q = await prisma.question.create({
        data: {
          lessonId,
          source: "OAK_EXIT_QUIZ",
          stage: "CHECK",
          order: i + 1,
          type: "MULTIPLE_CHOICE",
          prompt: `Check question ${i + 1}`,
          options: { choices: [{ id: "a", text: "Correct" }, { id: "b", text: "Wrong" }] },
          answerKey: { correctOptionId: correctId },
          maxScore: 1,
        },
      });
      if (i === 0) checkQ1 = q.id;
      if (i === 1) checkQ2 = q.id;
      if (i === 2) checkQ3 = q.id;
    }

    const assignment = await prisma.dailyAssignment.create({
      data: {
        studentId,
        date: new Date(Date.UTC(2026, 0, 5)),
        order: 0,
        kind: "LESSON",
        source: "AUTO",
        status: "PLANNED",
        subjectId: subject.id,
        lessonId,
        estimatedMinutes: 50,
      },
    });
    assignmentId = assignment.id;
  });

  it("walks start → drafts → STARTER → LEARN → PRACTICE → CHECK → retry → FEEDBACK → COMPLETE", async () => {
    // ── start ──
    const attempt = await startOrResumeAttempt(studentId, lessonId, assignmentId);
    expect(attempt.attemptNumber).toBe(1);
    expect(attempt.status).toBe("IN_PROGRESS");
    expect(attempt.currentStage).toBe("STARTER");

    const assignmentAfterStart = await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    expect(assignmentAfterStart.status).toBe("IN_PROGRESS");

    const progressAfterStart = await prisma.studentLessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId, lessonId } },
    });
    expect(progressAfterStart.status).toBe("IN_PROGRESS");
    expect(progressAfterStart.attempts).toBe(1);

    const log = await prisma.activityLog.findFirst({ where: { studentId, kind: "lesson_started" } });
    expect(log).not.toBeNull();

    // resuming returns the same attempt, no duplicate
    const resumed = await startOrResumeAttempt(studentId, lessonId, assignmentId);
    expect(resumed.id).toBe(attempt.id);
    const attemptCount = await prisma.lessonAttempt.count({ where: { studentId, lessonId } });
    expect(attemptCount).toBe(1);

    // ── drafts ──
    await saveDraftAnswer(attempt.id, studentId, starterQ1, { optionId: "a" });
    await saveDraftAnswer(attempt.id, studentId, starterQ2, { optionId: "a" });

    const view = await getAttemptView(attempt.id, studentId);
    expect(view.questionsByStage.STARTER).toHaveLength(2);
    expect(view.questionsByStage.STARTER[0]).not.toHaveProperty("answerKey");
    expect(view.drafts[starterQ1]).toEqual({ optionId: "a" });
    expect(view.stages.find((s) => s.stage === "STARTER")?.status).toBe("current");

    // draft is mutable: overwrite before submit
    await saveDraftAnswer(attempt.id, studentId, starterQ2, { optionId: "a" });

    // ── submit STARTER ──
    const starterResult = await submitStage(attempt.id, studentId, "STARTER");
    expect(starterResult.activity.status).toBe("GRADED");
    expect(starterResult.activity.score).toBe(2);
    expect(starterResult.activity.maxScore).toBe(2);
    expect(starterResult.results).toHaveLength(2);
    expect(starterResult.results.every((r) => r.isCorrect)).toBe(true);

    const afterStarter = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(afterStarter.starterCompletedAt).not.toBeNull();
    expect(afterStarter.currentStage).toBe("LEARN");

    // resubmitting STARTER does not change the graded rows (immutability)
    const beforeResubmit = await prisma.questionAttempt.findFirst({ where: { questionId: starterQ1 } });
    await submitStage(attempt.id, studentId, "STARTER");
    const afterResubmit = await prisma.questionAttempt.findFirst({ where: { questionId: starterQ1 } });
    expect(afterResubmit?.gradedAt?.getTime()).toBe(beforeResubmit?.gradedAt?.getTime());
    expect(afterResubmit?.score).toBe(beforeResubmit?.score);

    // ── LEARN ──
    const afterLearn = await completeStage(attempt.id, studentId, "LEARN");
    expect(afterLearn.instructionCompletedAt).not.toBeNull();
    expect(afterLearn.currentStage).toBe("PRACTICE");

    // ── PRACTICE ──
    await saveDraftAnswer(attempt.id, studentId, practiceNumeric, { text: "1/2" });
    await saveDraftAnswer(attempt.id, studentId, practiceExtended, { text: "Because the parts must be the same size." });

    const practiceResult = await submitStage(attempt.id, studentId, "PRACTICE");
    expect(practiceResult.activity.score).toBe(3);
    expect(practiceResult.activity.maxScore).toBe(3);
    const numericRow = practiceResult.results.find((r) => r.questionId === practiceNumeric)!;
    expect(numericRow.gradedBy).toBe("DETERMINISTIC");
    expect(numericRow.isCorrect).toBe(true);
    const extendedRow = practiceResult.results.find((r) => r.questionId === practiceExtended)!;
    expect(extendedRow.gradedBy).toBe("AI");
    expect(extendedRow.score).toBe(2);

    const afterPractice = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(afterPractice.practiceCompletedAt).not.toBeNull();
    expect(afterPractice.currentStage).toBe("CHECK");

    // ── CHECK: 2 correct, 1 wrong (66.7% — below the 70% review threshold) ──
    await saveDraftAnswer(attempt.id, studentId, checkQ1, { optionId: "a" });
    await saveDraftAnswer(attempt.id, studentId, checkQ2, { optionId: "a" });
    await saveDraftAnswer(attempt.id, studentId, checkQ3, { optionId: "b" }); // wrong

    const checkResult = await submitStage(attempt.id, studentId, "CHECK");
    expect(checkResult.activity.score).toBe(2);
    expect(checkResult.activity.maxScore).toBe(3);
    expect(checkResult.activity.percentage).toBeCloseTo((2 / 3) * 100, 5);

    const afterCheck = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(afterCheck.assessmentCompletedAt).not.toBeNull();
    expect(afterCheck.currentStage).toBe("FEEDBACK");
    expect(afterCheck.masteryScore).toBeCloseTo(0.8 * (2 / 3) + 0.2 * 1, 5);
    expect(afterCheck.feedbackSummary).toContain("Great work");

    const parentFeedback = await prisma.teacherFeedback.findFirst({ where: { lessonAttemptId: attempt.id } });
    expect(parentFeedback).not.toBeNull();

    // mastery record appended
    const masteryRecords = await prisma.masteryRecord.findMany({ where: { studentId, lessonId } });
    expect(masteryRecords).toHaveLength(1);
    expect(masteryRecords[0].previousMastery).toBeNull();

    // low-score review item created
    const reviewItems = await prisma.reviewItem.findMany({ where: { studentId, lessonId, reason: "LOW_SCORE" } });
    expect(reviewItems).toHaveLength(1);
    expect(reviewItems[0].status).toBe("PENDING");

    const progressAfterCheck = await prisma.studentLessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId, lessonId } },
    });
    expect(progressAfterCheck.bestScorePct).toBeCloseTo((2 / 3) * 100, 5);

    // ── retry the wrong CHECK question ──
    const wrongAttemptBefore = await prisma.questionAttempt.findFirst({
      where: { questionId: checkQ3 },
      orderBy: { attemptNumber: "desc" },
    });
    expect(wrongAttemptBefore?.isCorrect).toBe(false);

    // correct questions cannot be retried
    await expect(retryQuestion(attempt.id, studentId, checkQ1)).rejects.toThrow();

    await retryQuestion(attempt.id, studentId, checkQ3);
    const activityAfterRetry = await prisma.activityAttempt.findFirst({
      where: { lessonAttemptId: attempt.id, stage: "CHECK" },
      orderBy: { attemptNumber: "desc" },
    });
    expect(activityAfterRetry?.status).toBe("IN_PROGRESS");

    const newDraft = await prisma.questionAttempt.findFirst({
      where: { activityAttemptId: activityAfterRetry!.id, questionId: checkQ3 },
      orderBy: { attemptNumber: "desc" },
    });
    expect(newDraft?.gradedBy).toBe("PENDING");
    expect(newDraft?.attemptNumber).toBe((wrongAttemptBefore?.attemptNumber ?? 0) + 1);

    // a second retry attempt is refused — max 2 graded attempts on CHECK
    await saveDraftAnswer(attempt.id, studentId, checkQ3, { optionId: "b" }); // still wrong
    await submitStage(attempt.id, studentId, "CHECK");
    await expect(retryQuestion(attempt.id, studentId, checkQ3)).rejects.toThrow();

    // one more retry cycle, this time correct
    // (undo: simulate by re-opening via direct grading correction is not allowed —
    //  instead confirm the cap holds and finish the flow using the current, still-wrong state)
    const gradedRowsForQ3 = await prisma.questionAttempt.count({
      where: { questionId: checkQ3, gradedBy: { not: "PENDING" } },
    });
    expect(gradedRowsForQ3).toBe(2);

    // confirm the originally-correct CHECK rows were never touched by the retry/resubmit
    const q1Row = await prisma.questionAttempt.findFirst({ where: { questionId: checkQ1 } });
    expect(q1Row?.attemptNumber).toBe(1);
    expect(q1Row?.isCorrect).toBe(true);

    // currentStage did not move backwards — the resubmits above were revisits of a done stage
    const afterRetryFlow = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(afterRetryFlow.currentStage).toBe("FEEDBACK");

    // ── FEEDBACK → COMPLETE ──
    const afterFeedback = await completeStage(attempt.id, studentId, "FEEDBACK");
    expect(afterFeedback.currentStage).toBe("COMPLETE");

    const completed = await completeStage(attempt.id, studentId, "COMPLETE");
    expect(completed.completedAt).not.toBeNull();
    expect(["COMPLETED", "NEEDS_REVIEW", "MASTERED"]).toContain(completed.status);
    // final blended masteryScore = 0.8×(2/3) + 0.2×1.0 ≈ 0.733 — between the 0.7 and 0.9
    // thresholds, so completion lands as plain COMPLETED even though the raw CHECK score
    // (66.7%) was low enough to raise a LOW_SCORE review item above.
    expect(completed.status).toBe("COMPLETED");
    expect(completed.masteryScore).toBeCloseTo(0.8 * (2 / 3) + 0.2 * 1, 5);

    const assignmentAfterComplete = await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    expect(assignmentAfterComplete.status).toBe("COMPLETED");
    expect(assignmentAfterComplete.completedAt).not.toBeNull();

    const finalProgress = await prisma.studentLessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId, lessonId } },
    });
    expect(finalProgress.status).toBe("COMPLETED");
    // still has an outstanding LOW_SCORE review item from the low check score, even
    // though completion itself landed as COMPLETED rather than NEEDS_REVIEW.
    const outstandingReview = await prisma.reviewItem.findFirst({
      where: { studentId, lessonId, reason: "LOW_SCORE", status: "PENDING" },
    });
    expect(outstandingReview).not.toBeNull();

    const completionLog = await prisma.activityLog.findFirst({ where: { studentId, kind: "lesson_completed" } });
    expect(completionLog).not.toBeNull();
  });
});
