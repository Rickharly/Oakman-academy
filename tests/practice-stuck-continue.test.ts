import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { pickLatestWithMarks } from "@/lib/lessons/activity-picks";
import {
  completeStage,
  getAttemptView,
  startOrResumeAttempt,
  submitStage,
} from "@/lib/lessons/service";
import { POST as submitAttempt } from "@/app/api/attempts/[attemptId]/submit/route";
import { hashPassword } from "@/lib/auth/password";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { createHash, randomBytes } from "node:crypto";

/**
 * The dead end a child reported: a PRACTICE stage graded with real marks, `currentStage` never
 * advanced off PRACTICE, and — because a later, empty round became the stage's "latest" activity
 * — a footer reading "0 out of 0" next to a "Continue to Check" button that only ever changed
 * the view to the stage already on screen. Every control on the page was a no-op.
 *
 * These tests build the reported end state directly (rather than the client sequence that is
 * believed to produce it — see the investigation notes in the report) and prove: the stage rail
 * / footer logic can read the real score out of it (`pickLatestWithMarks`), and the server call
 * the fixed "Continue" button now makes (`submitStage` again, via the `/submit` route) gets the
 * lesson moving all the way to completion.
 */
async function makeStudent(username: string) {
  const passwordHash = await hashPassword("1234");
  const user = await prisma.user.create({
    data: { role: "STUDENT", username, passwordHash, displayName: username, avatar: "🦊" },
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

async function buildLesson() {
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

/** Builds the reported end state: a real graded PRACTICE round, then an empty one, currentStage stuck at PRACTICE. */
async function buildStuckPracticeAttempt(studentId: string, lessonId: string) {
  const attempt = await startOrResumeAttempt(studentId, lessonId);
  await prisma.lessonAttempt.update({ where: { id: attempt.id }, data: { currentStage: "PRACTICE" } });

  // Round 1: real work, really marked — e.g. graded by /api/lessons/[lessonId]/practice/submit,
  // which grades its own round directly and never touches `currentStage`.
  const real = await prisma.activityAttempt.create({
    data: {
      lessonAttemptId: attempt.id,
      stage: "PRACTICE",
      attemptNumber: 1,
      status: "GRADED",
      submittedAt: new Date(),
      gradedAt: new Date(),
      score: 3,
      maxScore: 3,
      percentage: 100,
    },
  });

  // Round 2: graded with nothing in it — the shape `submitStage`'s empty-questions branch
  // produces when it later finds no PRACTICE questions left to grade for this student.
  await prisma.activityAttempt.create({
    data: {
      lessonAttemptId: attempt.id,
      stage: "PRACTICE",
      attemptNumber: 2,
      status: "GRADED",
      submittedAt: new Date(),
      gradedAt: new Date(),
      score: 0,
      maxScore: 0,
      percentage: null,
    },
  });

  const stuck = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
  expect(stuck.currentStage).toBe("PRACTICE"); // sanity: the state really is stuck before we test anything

  return { attempt, real };
}

describe("the reported dead end: real PRACTICE marks, then an empty round, currentStage stuck", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("pickLatestWithMarks reads the real score, not the empty round's 0/0", async () => {
    const { studentId, token: _token } = await makeStudent("kid-a");
    void _token;
    const lesson = await buildLesson();
    const { attempt, real } = await buildStuckPracticeAttempt(studentId, lesson.id);

    const view = await getAttemptView(attempt.id, studentId);
    const activities = view.activities
      .filter((a) => a.stage === "PRACTICE")
      .map((a) => ({ id: a.id, stage: "PRACTICE" as const, score: a.score, maxScore: a.maxScore }));
    expect(activities).toHaveLength(2);

    // The naive "latest activity" — what the footer used to read straight off — is the empty one.
    expect(activities[activities.length - 1].maxScore).toBe(0);

    // What the footer and the feedback screen now both read instead.
    const shown = pickLatestWithMarks(activities, "PRACTICE");
    expect(shown?.id).toBe(real.id);
    expect(shown?.score).toBe(3);
    expect(shown?.maxScore).toBe(3);
  });

  it("the Continue button's server call (submitStage via POST /submit) completes the stuck stage", async () => {
    const { studentId, token } = await makeStudent("kid-b");
    const lesson = await buildLesson();
    const { attempt } = await buildStuckPracticeAttempt(studentId, lesson.id);

    // This is exactly what the fixed "Continue to Check" button now does when it finds
    // `currentStage` still equal to the stage on screen: resubmit the stage instead of only
    // changing the view.
    const res = await submitAttempt(
      new Request(`http://localhost/api/attempts/${attempt.id}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
        body: JSON.stringify({ stage: "PRACTICE" }),
      }),
      { params: Promise.resolve({ attemptId: attempt.id }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { activity: { score: number | null; maxScore: number | null } };
    // Resubmitting a stage with nothing new to grade is a no-op on the marks — the real score
    // is neither lost nor re-earned.
    expect(body.activity.score).toBe(0); // this call itself has no questions left to grade…
    expect(body.activity.maxScore).toBe(0);

    // …but the thing that was actually broken is fixed: the lesson is no longer stuck.
    const after = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(after.currentStage).toBe("CHECK");

    // No duplicate/extra activity was created by asking again.
    const count = await prisma.activityAttempt.count({ where: { lessonAttemptId: attempt.id, stage: "PRACTICE" } });
    expect(count).toBe(2);
  });

  it("the lesson can be finished all the way through from this exact stuck state", async () => {
    const { studentId } = await makeStudent("kid-c");
    const lesson = await buildLesson();
    const { attempt } = await buildStuckPracticeAttempt(studentId, lesson.id);

    // Unstick PRACTICE (no CHECK questions exist for this fixture lesson either, so CHECK takes
    // the same "nothing to grade, just move on" path submit-stage-empty.test.ts covers).
    await submitStage(attempt.id, studentId, "PRACTICE");
    let current = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(current.currentStage).toBe("CHECK");

    await submitStage(attempt.id, studentId, "CHECK");
    current = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(current.currentStage).toBe("FEEDBACK");

    await completeStage(attempt.id, studentId, "FEEDBACK");
    const done = await completeStage(attempt.id, studentId, "COMPLETE");
    expect(done.status).not.toBe("IN_PROGRESS");
    expect(done.currentStage).toBe("COMPLETE");
  });
});
