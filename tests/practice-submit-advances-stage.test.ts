import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { Role, type LessonStage } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { POST as submitExtraPractice } from "@/app/api/lessons/[lessonId]/practice/submit/route";
import { submitStage } from "@/lib/lessons/service";
import { stageTimestampField } from "@/lib/lessons/stages";
import { resetDb } from "./helpers/db";

/**
 * The gap this closes: `POST /api/lessons/[lessonId]/practice/submit` graded a child's extra
 * practice and recorded it, but left `LessonAttempt.currentStage` exactly where it was — the
 * lesson only moved past PRACTICE if a *second*, separate request (the browser's own follow-up
 * `submitGraded("PRACTICE")`, i.e. `submitStage` via `/api/attempts/[attemptId]/submit`) also
 * landed. Any interruption of that second request — dropped connection, closed tab, a 500 —
 * left the work graded and the lesson frozen on Practice forever.
 *
 * These tests prove the fix: the stage now advances as a direct consequence of the extra
 * practice itself being graded, in the same request, and only when that is genuinely correct
 * (still on PRACTICE, not revisiting from FEEDBACK/COMPLETE) — and that the browser's follow-up
 * call remains harmless when it arrives after the stage has already moved on.
 */

async function makeStudent(username: string) {
  const passwordHash = await hashPassword("1234");
  const user = await prisma.user.create({
    data: { role: Role.STUDENT, username, passwordHash, displayName: username, avatar: "🦊" },
  });
  const profile = await prisma.studentProfile.create({ data: { userId: user.id, yearGroup: 5, keyStage: "ks2" } });
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  return { studentId: profile.id, token };
}

async function makeLesson() {
  const subject = await prisma.subject.create({ data: { slug: `s-${Math.random()}`, title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { providerSlug: `p-${Math.random()}`, subjectId: subject.id, yearGroup: 5, keyStage: "ks2", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { providerSlug: `u-${Math.random()}`, programmeId: programme.id, title: "Fractions", order: 1 },
  });
  return prisma.lesson.create({
    data: { providerSlug: `l-${Math.random()}`, unitId: unit.id, title: "Halving", order: 1 },
  });
}

async function makeAttempt(studentId: string, lessonId: string, currentStage: LessonStage, extra: Record<string, unknown> = {}) {
  return prisma.lessonAttempt.create({
    data: { studentId, lessonId, attemptNumber: 1, status: "IN_PROGRESS", currentStage, ...extra },
  });
}

async function makeExtraQuestion(lessonId: string, studentId: string, ref: string) {
  return prisma.question.create({
    data: {
      lessonId,
      source: "AI_GENERATED",
      stage: "PRACTICE",
      order: 900,
      type: "SHORT_ANSWER",
      prompt: `Extra practice question ${ref}`,
      answerKey: { accepted: ["answer"], caseSensitive: false },
      maxScore: 1,
      gradingMode: "DETERMINISTIC",
      generatedForStudentId: studentId,
      providerRef: ref,
    },
  });
}

function submit(lessonId: string, token: string, body: unknown) {
  return submitExtraPractice(
    new Request(`http://localhost/api/lessons/${lessonId}/practice/submit`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ lessonId }) },
  );
}

describe("extra practice submit advances the lesson stage itself", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("advances PRACTICE to CHECK and stamps the same field the normal path stamps", async () => {
    const lesson = await makeLesson();
    const { studentId, token } = await makeStudent("kid-practice");
    const attempt = await makeAttempt(studentId, lesson.id, "PRACTICE");
    const question = await makeExtraQuestion(lesson.id, studentId, "advance-1");

    const res = await submit(lesson.id, token, {
      attemptId: attempt.id,
      answers: { [question.id]: { text: "answer" } },
    });
    expect(res.status).toBe(200);

    const after = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(after.currentStage).toBe("CHECK");

    // The exact field `finalizeStageAdvance`/`submitStage` stamps for PRACTICE — proving this is
    // the same transition, not a parallel one.
    const field = stageTimestampField("PRACTICE")!;
    expect((after as unknown as Record<string, Date | null>)[field]).not.toBeNull();
  });

  it.each(["FEEDBACK", "COMPLETE"] as const)(
    "leaves currentStage untouched when extra practice is submitted from %s",
    async (stage) => {
      const lesson = await makeLesson();
      const { studentId, token } = await makeStudent(`kid-${stage.toLowerCase()}`);
      // A lesson genuinely at this stage already has practiceCompletedAt stamped from its first,
      // ordinary pass through PRACTICE — set that up so we can also prove it is left alone.
      const practiceCompletedAt = new Date("2026-01-01T00:00:00.000Z");
      const attempt = await makeAttempt(studentId, lesson.id, stage, {
        practiceCompletedAt,
        status: stage === "COMPLETE" ? "COMPLETED" : "IN_PROGRESS",
      });
      const question = await makeExtraQuestion(lesson.id, studentId, `revisit-${stage}`);

      const res = await submit(lesson.id, token, {
        attemptId: attempt.id,
        answers: { [question.id]: { text: "answer" } },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: { isCorrect: boolean }[]; correct: number; total: number };
      // The marks from the extra practice are still recorded correctly.
      expect(body.total).toBe(1);
      expect(body.correct).toBe(1);

      const after = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
      expect(after.currentStage).toBe(stage); // never moved — revisiting, not progressing
      expect(after.practiceCompletedAt?.toISOString()).toBe(practiceCompletedAt.toISOString());

      // The work is still recorded as learning history: an activity and a graded attempt exist.
      const activity = await prisma.activityAttempt.findFirst({ where: { lessonAttemptId: attempt.id, stage: "PRACTICE" } });
      expect(activity?.status).toBe("GRADED");
      expect(activity?.score).toBe(1);
      const qa = await prisma.questionAttempt.findFirst({ where: { activityAttemptId: activity!.id, questionId: question.id } });
      expect(qa?.isCorrect).toBe(true);
    },
  );

  it("the browser's follow-up submitStage(\"PRACTICE\") after the stage already advanced is harmless", async () => {
    const lesson = await makeLesson();
    const { studentId, token } = await makeStudent("kid-followup");
    const attempt = await makeAttempt(studentId, lesson.id, "PRACTICE");
    const question = await makeExtraQuestion(lesson.id, studentId, "followup-1");

    const res = await submit(lesson.id, token, {
      attemptId: attempt.id,
      answers: { [question.id]: { text: "answer" } },
    });
    expect(res.status).toBe(200);

    const advanced = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(advanced.currentStage).toBe("CHECK");

    const activityBefore = await prisma.activityAttempt.findFirstOrThrow({
      where: { lessonAttemptId: attempt.id, stage: "PRACTICE" },
    });
    const qaBefore = await prisma.questionAttempt.findFirstOrThrow({
      where: { activityAttemptId: activityBefore.id, questionId: question.id },
    });
    expect(qaBefore.isCorrect).toBe(true);
    expect(qaBefore.gradedBy).not.toBe("PENDING");

    // Exactly what the browser's follow-up `submitGraded("PRACTICE")` does: resubmit the
    // PRACTICE stage via `submitStage`, arriving after this server-side advance already ran.
    const followUp = await submitStage(attempt.id, studentId, "PRACTICE");
    expect(followUp.activity.id).toBe(activityBefore.id); // no duplicate activity created

    const activityAfter = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: activityBefore.id } });
    const qaAfter = await prisma.questionAttempt.findUniqueOrThrow({ where: { id: qaBefore.id } });

    // No re-grading: the exact same row, same marks, same grading path.
    expect(qaAfter.id).toBe(qaBefore.id);
    expect(qaAfter.gradedAt).toStrictEqual(qaBefore.gradedAt);
    expect(qaAfter.gradedBy).toBe(qaBefore.gradedBy);
    expect(qaAfter.isCorrect).toBe(true);
    expect(qaAfter.score).toBe(qaBefore.score);

    // No duplicate activity, and the marks from the extra practice are preserved exactly.
    const activityCount = await prisma.activityAttempt.count({ where: { lessonAttemptId: attempt.id, stage: "PRACTICE" } });
    expect(activityCount).toBe(1);
    expect(activityAfter.score).toBe(activityBefore.score);
    expect(activityAfter.maxScore).toBe(activityBefore.maxScore);

    // No stage regression — still CHECK, not bounced back to PRACTICE or pushed past CHECK.
    const finalAttempt = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(finalAttempt.currentStage).toBe("CHECK");
  });
});
