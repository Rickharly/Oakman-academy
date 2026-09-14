import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { Role } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { teacherAgent } from "@/lib/ai/teacher-agent";
import { POST as submitExtraPractice } from "@/app/api/lessons/[lessonId]/practice/submit/route";
import { resetDb } from "./helpers/db";

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

describe("a sibling's AI-written practice is never handed to another student", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("does not reuse another student's stored AI_GENERATED practice questions", async () => {
    const lesson = await makeLesson();
    const a = await makeStudent("student-a");
    const b = await makeStudent("student-b");

    // Student A already has a full stored batch of general practice for this lesson.
    for (let i = 0; i < 5; i++) {
      await prisma.question.create({
        data: {
          lessonId: lesson.id,
          source: "AI_GENERATED",
          stage: "PRACTICE",
          order: 900 + i,
          type: "SHORT_ANSWER",
          prompt: `A's question ${i}`,
          answerKey: { accepted: ["answer"], caseSensitive: false },
          maxScore: 1,
          gradingMode: "DETERMINISTIC",
          generatedForStudentId: a.studentId,
          providerRef: `a:${i}`,
        },
      });
    }

    const forB = await teacherAgent.generateLessonPractice({ studentId: b.studentId, lessonId: lesson.id });

    expect(forB.length).toBeGreaterThan(0);
    for (const q of forB) {
      expect(q.generatedForStudentId).toBe(b.studentId);
      expect(q.prompt.startsWith("A's question")).toBe(false);
    }
  });
});

describe("extra practice is graded against the whole shown set, not just what was answered", () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function makeAttempt(studentId: string, lessonId: string) {
    return prisma.lessonAttempt.create({
      data: { studentId, lessonId, attemptNumber: 1, status: "IN_PROGRESS", currentStage: "PRACTICE" },
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

  it("counts an AI-generated question left blank as wrong, not as skipped", async () => {
    const lesson = await makeLesson();
    const { studentId, token } = await makeStudent("student-c");
    const attempt = await makeAttempt(studentId, lesson.id);

    const questions = await Promise.all(
      [0, 1, 2].map((i) =>
        prisma.question.create({
          data: {
            lessonId: lesson.id,
            source: "AI_GENERATED",
            stage: "PRACTICE",
            order: 900 + i,
            type: "SHORT_ANSWER",
            prompt: `Extra practice question ${i}`,
            answerKey: { accepted: ["answer"], caseSensitive: false },
            maxScore: 1,
            gradingMode: "DETERMINISTIC",
            generatedForStudentId: studentId,
            providerRef: `c:${i}`,
          },
        }),
      ),
    );

    // Only the first of three shown questions gets an answer — the other two are left blank.
    const res = await submit(lesson.id, token, {
      attemptId: attempt.id,
      answers: { [questions[0]!.id]: { text: "answer" } },
    });
    const body = (await res.json()) as { results: { questionId: string; isCorrect: boolean }[]; correct: number; total: number };

    expect(res.status).toBe(200);
    expect(body.total).toBe(3); // the whole shown batch, not just the one they answered
    expect(body.correct).toBe(1);
    expect(body.results).toHaveLength(3);
    const blankResults = body.results.filter((r) => r.questionId !== questions[0]!.id);
    expect(blankResults.every((r) => r.isCorrect === false)).toBe(true);
  });

  it("counts a worksheet question left blank as wrong too", async () => {
    const lesson = await makeLesson();
    const { studentId, token } = await makeStudent("student-d");
    const attempt = await makeAttempt(studentId, lesson.id);

    const questions = await Promise.all(
      [0, 1, 2, 3].map((i) =>
        prisma.question.create({
          data: {
            lessonId: lesson.id,
            source: "OAK_WORKSHEET",
            stage: "PRACTICE",
            order: i + 1,
            type: "SHORT_ANSWER",
            prompt: `Worksheet question ${i}`,
            answerKey: { accepted: ["answer"], caseSensitive: false },
            maxScore: 1,
            gradingMode: "DETERMINISTIC",
            providerRef: `w:${i}`,
          },
        }),
      ),
    );

    // Two of the four worksheet questions answered correctly, two left untouched.
    const res = await submit(lesson.id, token, {
      attemptId: attempt.id,
      answers: {
        [questions[0]!.id]: { text: "answer" },
        [questions[1]!.id]: { text: "answer" },
      },
    });
    const body = (await res.json()) as { correct: number; total: number };

    expect(body.total).toBe(4);
    expect(body.correct).toBe(2);
  });
});
