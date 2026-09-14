import { beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";

vi.mock("@/lib/ai/teacher-agent", () => ({
  teacherAgent: {
    chat: vi.fn(),
    grade: vi.fn(),
    summarizeLesson: vi.fn(async () => ({ forStudent: "Nice work.", forParent: null, misconceptions: [] })),
    summarizeDay: vi.fn(),
    generatePractice: vi.fn(),
    identifyMisconceptions: vi.fn(async () => []),
  },
  teacherModeForStage: () => "LEARN",
}));

const { startOrResumeAttempt, submitStage, retryQuestion, completeStage, settleFinishedLessons } = await import(
  "@/lib/lessons/service"
);

/**
 * An interrupted CHECK retry must not dead-end the lesson.
 *
 * `retryQuestion` flips the whole CHECK activity to IN_PROGRESS so a draft save targets the
 * right round. If the child reloads before answering the retry, the activity is stuck
 * IN_PROGRESS forever unless something recognises it was graded once — without that, Finish
 * refuses ("the quiz has not been marked yet") over a quiz that plainly was.
 */
describe("an interrupted CHECK retry", () => {
  let studentId: string;
  let lessonId: string;
  let q1: string;
  let q2: string;

  beforeAll(async () => {
    await resetDb();

    const user = await prisma.user.create({
      data: { role: "STUDENT", username: "retrier", passwordHash: "x", displayName: "Eva" },
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

    const mk = async (order: number, correctId: string) =>
      prisma.question.create({
        data: {
          lessonId,
          source: "OAK_EXIT_QUIZ",
          stage: "CHECK",
          order,
          type: "MULTIPLE_CHOICE",
          prompt: `Question ${order}`,
          options: { choices: [{ id: "a", text: "Correct" }, { id: "b", text: "Wrong" }] },
          answerKey: { correctOptionId: correctId },
          maxScore: 1,
        },
      });
    q1 = (await mk(1, "a")).id;
    q2 = (await mk(2, "a")).id;
  });

  it("lets Finish succeed, and keeps the original marks, after a retry is never answered", async () => {
    const attempt = await startOrResumeAttempt(studentId, lessonId);
    await prisma.lessonAttempt.update({ where: { id: attempt.id }, data: { currentStage: "CHECK" } });

    const { saveDraftAnswer } = await import("@/lib/lessons/service");
    await saveDraftAnswer(attempt.id, studentId, q1, { optionId: "a" }); // correct
    await saveDraftAnswer(attempt.id, studentId, q2, { optionId: "b" }); // wrong

    const graded = await submitStage(attempt.id, studentId, "CHECK");
    expect(graded.activity.score).toBe(1);
    expect(graded.activity.maxScore).toBe(2);

    const afterGrade = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    const originalMastery = afterGrade.masteryScore;
    expect(originalMastery).not.toBeNull();

    // Retry the wrong question, then reload without ever answering it.
    await retryQuestion(attempt.id, studentId, q2);
    const activity = await prisma.activityAttempt.findFirst({
      where: { lessonAttemptId: attempt.id, stage: "CHECK" },
      orderBy: { attemptNumber: "desc" },
    });
    expect(activity?.status).toBe("IN_PROGRESS");
    expect(activity?.gradedAt).not.toBeNull(); // graded once, just reopened

    await completeStage(attempt.id, studentId, "FEEDBACK");
    const done = await completeStage(attempt.id, studentId, "COMPLETE");
    expect(done.status).not.toBe("IN_PROGRESS");
    // Mastery is exactly what the original grading produced — the abandoned retry never
    // re-graded anything.
    expect(done.masteryScore).toBeCloseTo(originalMastery!, 10);
  });

  it("settleFinishedLessons still picks up a lesson stuck on an interrupted retry", async () => {
    const attempt = await startOrResumeAttempt(studentId, lessonId);
    await prisma.lessonAttempt.update({ where: { id: attempt.id }, data: { currentStage: "CHECK" } });
    const { saveDraftAnswer } = await import("@/lib/lessons/service");
    await saveDraftAnswer(attempt.id, studentId, q1, { optionId: "b" });
    await saveDraftAnswer(attempt.id, studentId, q2, { optionId: "b" });
    await submitStage(attempt.id, studentId, "CHECK");
    await retryQuestion(attempt.id, studentId, q1);

    // Backdate the grading so it looks old enough to settle.
    await prisma.activityAttempt.updateMany({
      where: { lessonAttemptId: attempt.id, stage: "CHECK" },
      data: { gradedAt: new Date(Date.now() - 30 * 60 * 1000) },
    });

    const settled = await settleFinishedLessons(studentId);
    expect(settled).toBeGreaterThanOrEqual(1);
    const after = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(after.status).not.toBe("IN_PROGRESS");
  });
});
