import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { periodSecondsSpent } from "@/lib/lessons/service";
import { toDateOnly } from "@/lib/dates";

/**
 * A period is forty-five minutes of a subject, not of a lesson.
 *
 * Without this, a child who finished a topic in twelve minutes and started the next one got a
 * fresh forty-five minutes with it, and the school day never ended.
 */
const TODAY = "2026-09-25";

async function subjectWithTwoLessons() {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: "mikhael", passwordHash: "x", displayName: "Mikhael" },
  });
  const student = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 4, keyStage: "ks2" },
  });
  const subject = await prisma.subject.create({ data: { provider: "test", slug: "maths", title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { provider: "test", providerSlug: "maths:4", subjectId: subject.id, yearGroup: 4, keyStage: "ks2", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { provider: "test", providerSlug: "u1", programmeId: programme.id, title: "U", order: 1 },
  });
  const first = await prisma.lesson.create({
    data: { provider: "test", providerSlug: "l1", unitId: unit.id, title: "Topic one", order: 1 },
  });
  const second = await prisma.lesson.create({
    data: { provider: "test", providerSlug: "l2", unitId: unit.id, title: "Topic two", order: 2 },
  });
  const other = await prisma.subject.create({ data: { provider: "test", slug: "english", title: "English" } });
  return { studentId: student.id, subjectId: subject.id, otherSubjectId: other.id, first, second };
}

describe("the period clock", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("carries across topics of the same subject", async () => {
    const { studentId, subjectId, first, second } = await subjectWithTwoLessons();

    await prisma.lessonAttempt.create({
      data: { studentId, lessonId: first.id, attemptNumber: 1, timeSpentSeconds: 12 * 60, status: "COMPLETED" },
    });
    await prisma.lessonAttempt.create({
      data: { studentId, lessonId: second.id, attemptNumber: 1, timeSpentSeconds: 5 * 60 },
    });

    const spent = await periodSecondsSpent(studentId, subjectId, toDateOnly(TODAY));
    // Seventeen minutes of maths, not five: starting the second topic does not restart the hour.
    expect(spent).toBe(17 * 60);
  });

  it("does not count another subject's period", async () => {
    const { studentId, subjectId, otherSubjectId, first } = await subjectWithTwoLessons();
    await prisma.lessonAttempt.create({
      data: { studentId, lessonId: first.id, attemptNumber: 1, timeSpentSeconds: 10 * 60 },
    });

    expect(await periodSecondsSpent(studentId, subjectId, toDateOnly(TODAY))).toBe(10 * 60);
    expect(await periodSecondsSpent(studentId, otherSubjectId, toDateOnly(TODAY))).toBe(0);
  });

  it("does not count yesterday", async () => {
    const { studentId, subjectId, first } = await subjectWithTwoLessons();
    const attempt = await prisma.lessonAttempt.create({
      data: { studentId, lessonId: first.id, attemptNumber: 1, timeSpentSeconds: 40 * 60 },
    });
    await prisma.lessonAttempt.update({
      where: { id: attempt.id },
      data: { startedAt: new Date(Date.UTC(2026, 8, 24, 9, 0, 0)) },
    });

    expect(await periodSecondsSpent(studentId, subjectId, toDateOnly(TODAY))).toBe(0);
  });
});
