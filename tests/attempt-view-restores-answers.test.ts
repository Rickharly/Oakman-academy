import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { ApiError } from "@/lib/auth/api";
import { getAttemptView, saveDraftAnswer, startOrResumeAttempt, submitStage } from "@/lib/lessons/service";

/**
 * `getAttemptView` used to return only PENDING question responses in `drafts`, on the theory
 * that a graded question shows its answer some other way. It doesn't: the renderer is handed
 * `value={drafts[q.id]}`, so a graded question with nothing in `drafts` renders with no answer
 * chosen at all — disabled, next to feedback saying "well done, that's correct" for a choice the
 * child can no longer see. This is exactly what a reload after the STARTER/PRACTICE stage was
 * marked showed: correct-looking feedback with a blank box underneath it.
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

describe("getAttemptView restores what the child actually answered", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("keeps a graded question's chosen response in `drafts`, not just PENDING ones", async () => {
    const { studentId, lessonId } = await buildLesson();
    const question = await prisma.question.create({
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

    const attempt = await startOrResumeAttempt(studentId, lessonId);
    await saveDraftAnswer(attempt.id, studentId, question.id, { optionId: "a" });

    const beforeSubmit = await getAttemptView(attempt.id, studentId);
    expect(beforeSubmit.drafts[question.id]).toEqual({ optionId: "a" }); // still PENDING — unchanged behaviour

    await submitStage(attempt.id, studentId, "STARTER");

    const afterSubmit = await getAttemptView(attempt.id, studentId);
    // The stage is graded now — this is the exact case that went missing.
    expect(afterSubmit.drafts[question.id]).toEqual({ optionId: "a" });

    // The guard the reviewer asked to keep: a stray write into the now-graded round still
    // refuses, rather than quietly opening a fresh empty one under the child.
    await expect(saveDraftAnswer(attempt.id, studentId, question.id, { optionId: "b" })).rejects.toThrow(ApiError);
    const activityCount = await prisma.activityAttempt.count({ where: { lessonAttemptId: attempt.id, stage: "STARTER" } });
    expect(activityCount).toBe(1);
  });

  it("resolves a question answered across two activities to the chronologically latest one", async () => {
    // `attemptNumber` on a QuestionAttempt only counts retries *within one activity* — it is
    // not comparable across two different ActivityAttempt rows for the same question. A drafts
    // builder that compared it globally could show a later round's real answer as if the
    // question had never been touched, or an earlier round's stale one instead of the current.
    const { studentId, lessonId } = await buildLesson();
    const question = await prisma.question.create({
      data: {
        lessonId,
        source: "AI_GENERATED",
        stage: "PRACTICE",
        order: 1,
        type: "SHORT_ANSWER",
        prompt: "Extra practice question",
        answerKey: { accepted: ["answer"], caseSensitive: false },
        maxScore: 1,
        generatedForStudentId: studentId,
      },
    });

    const attempt = await startOrResumeAttempt(studentId, lessonId);
    await prisma.lessonAttempt.update({ where: { id: attempt.id }, data: { currentStage: "PRACTICE" } });

    // Round 1: answered and graded — attemptNumber 1 within this activity.
    const activity1 = await prisma.activityAttempt.create({
      data: { lessonAttemptId: attempt.id, stage: "PRACTICE", attemptNumber: 1, status: "GRADED", gradedAt: new Date() },
    });
    await prisma.questionAttempt.create({
      data: {
        activityAttemptId: activity1.id,
        questionId: question.id,
        studentId,
        attemptNumber: 1,
        response: { text: "wrong first go" },
        gradedBy: "DETERMINISTIC",
        isCorrect: false,
        score: 0,
        maxScore: 1,
      },
    });

    // Round 2 (later, its own activity): the same question answered again — also attemptNumber
    // 1, because it is the first attempt *within this activity*, not a "retry" of round 1's row.
    const activity2 = await prisma.activityAttempt.create({
      data: { lessonAttemptId: attempt.id, stage: "PRACTICE", attemptNumber: 2, status: "GRADED", gradedAt: new Date() },
    });
    await prisma.questionAttempt.create({
      data: {
        activityAttemptId: activity2.id,
        questionId: question.id,
        studentId,
        attemptNumber: 1,
        response: { text: "answer" },
        gradedBy: "DETERMINISTIC",
        isCorrect: true,
        score: 1,
        maxScore: 1,
      },
    });

    const view = await getAttemptView(attempt.id, studentId);
    // The later activity's answer wins, even though its attemptNumber (1) is not "greater than"
    // round 1's (also 1) — the two are not the same counter.
    expect(view.drafts[question.id]).toEqual({ text: "answer" });
  });
});
