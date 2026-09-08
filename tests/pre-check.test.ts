import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { judgePreCheck, placeOutOfLesson, PRE_CHECK_PASS } from "@/lib/lessons/pre-check";
import { toDateOnly } from "@/lib/dates";

let studentId: string;
let lessonId: string;

beforeEach(async () => {
  await resetDb();
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: "knows-it", passwordHash: "x", displayName: "Eva" },
  });
  const profile = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 7, keyStage: "ks3" },
  });
  studentId = profile.id;

  const subject = await prisma.subject.create({ data: { provider: "t", slug: "maths", title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { provider: "t", providerSlug: "m7", subjectId: subject.id, yearGroup: 7, keyStage: "ks3", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { provider: "t", providerSlug: "u1", programmeId: programme.id, title: "Fractions", order: 1 },
  });
  const lesson = await prisma.lesson.create({
    data: { provider: "t", providerSlug: "l1", unitId: unit.id, title: "Equivalent fractions", order: 1 },
  });
  lessonId = lesson.id;
});

describe("checking whether they already know the lesson", () => {
  it("lets a child past when they get nearly everything right", async () => {
    const outcome = await judgePreCheck({ studentId, lessonId, correct: 5, total: 5 });

    expect(outcome.passed).toBe(true);
    const progress = await prisma.studentLessonProgress.findFirstOrThrow({ where: { studentId, lessonId } });
    expect(progress.status).toBe("MASTERED");
  });

  it("does not let a good-but-not-certain score through", async () => {
    // 4/5 is 80%: better than most, and still not proof they can skip a lesson.
    const outcome = await judgePreCheck({ studentId, lessonId, correct: 4, total: 5 });

    expect(outcome.passed).toBe(false);
    expect(PRE_CHECK_PASS).toBeGreaterThan(0.8);
    expect(await prisma.studentLessonProgress.count({ where: { studentId, status: "MASTERED" } })).toBe(0);
  });

  it("refuses to skip a lesson on too few questions, however well they did", async () => {
    // Two out of two is a coin toss twice, not evidence.
    const outcome = await judgePreCheck({ studentId, lessonId, correct: 2, total: 2 });
    expect(outcome.passed).toBe(false);
  });

  it("records that the lesson was assessed, not taught", async () => {
    await placeOutOfLesson(studentId, lessonId, 100);

    const record = await prisma.masteryRecord.findFirstOrThrow({ where: { studentId, lessonId } });
    // A school reading the record must be able to tell this apart from a lesson worked through.
    expect(record.reason).toBe("placement_check");

    const attempts = await prisma.lessonAttempt.count({ where: { studentId, lessonId } });
    expect(attempts).toBe(0); // no invented lesson attempt
  });

  it("closes today's assignment for a lesson they placed out of", async () => {
    const assignment = await prisma.dailyAssignment.create({
      data: {
        studentId,
        date: toDateOnly("2026-09-07"),
        order: 0,
        kind: "LESSON",
        source: "AUTO",
        lessonId,
        estimatedMinutes: 45,
      },
    });

    await placeOutOfLesson(studentId, lessonId, 100);

    const after = await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(after.status).toBe("COMPLETED");
  });

  it("rejects an empty submission rather than passing it", async () => {
    await expect(judgePreCheck({ studentId, lessonId, correct: 0, total: 0 })).rejects.toThrow();
  });
});
