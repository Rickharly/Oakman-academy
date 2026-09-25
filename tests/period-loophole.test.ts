import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { settleFinishedLessons, submitStage, unfinishedPeriod } from "@/lib/lessons/service";
import { schoolDayKey, toDateOnly } from "@/lib/dates";

/**
 * The hole a nine year old found in a day: answer the quiz, close the tab, reopen the app, and
 * the period is ticked and gone. Twelve minutes of work bought a forty-five minute period.
 *
 * Doing the quiz is not the end of the period. The end of the period is the end of the period,
 * and anyone who comes back mid-period goes back into the lesson.
 */
const TODAY = schoolDayKey();

async function studentMidPeriod(opts: { minutesSpent: number }) {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: `s${Math.random().toString(36).slice(2, 8)}`, passwordHash: "x", displayName: "Mikhael" },
  });
  const student = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 4, keyStage: "ks2", lessonsPerDay: 5, lessonMinutes: 45 },
  });
  const subject = await prisma.subject.create({ data: { provider: "test", slug: "maths", title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { provider: "test", providerSlug: "maths:4", subjectId: subject.id, yearGroup: 4, keyStage: "ks2", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { provider: "test", providerSlug: "u1", programmeId: programme.id, title: "U", order: 1 },
  });
  const lesson = await prisma.lesson.create({
    data: { provider: "test", providerSlug: "l1", unitId: unit.id, title: "Topic one", order: 1 },
  });
  const second = await prisma.lesson.create({
    data: { provider: "test", providerSlug: "l2", unitId: unit.id, title: "Topic two", order: 2 },
  });
  const assignment = await prisma.dailyAssignment.create({
    data: {
      studentId: student.id,
      date: toDateOnly(TODAY),
      order: 0,
      kind: "LESSON",
      subjectId: subject.id,
      lessonId: lesson.id,
      estimatedMinutes: 45,
      source: "AUTO",
      status: "IN_PROGRESS",
    },
  });
  const attempt = await prisma.lessonAttempt.create({
    data: {
      studentId: student.id,
      lessonId: lesson.id,
      assignmentId: assignment.id,
      attemptNumber: 1,
      currentStage: "CHECK",
      timeSpentSeconds: opts.minutesSpent * 60,
    },
  });
  return { studentId: student.id, assignment, attempt, lesson, second };
}

describe("closing the tab mid-period", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("does not tick the period done when the quiz is marked", async () => {
    const { studentId, assignment, attempt } = await studentMidPeriod({ minutesSpent: 12 });

    await submitStage(attempt.id, studentId, "CHECK");

    const after = await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    // Begun, not finished. Twelve minutes is not a period however well the quiz went.
    expect(after.status).toBe("IN_PROGRESS");
    expect(after.completedAt).toBeNull();
  });

  it("sends them back into the lesson when they reopen the app", async () => {
    const { studentId, assignment, lesson } = await studentMidPeriod({ minutesSpent: 12 });

    const resume = await unfinishedPeriod(studentId, TODAY);
    expect(resume).not.toBeNull();
    expect(resume!.lessonId).toBe(lesson.id);
    expect(resume!.assignmentId).toBe(assignment.id);
  });

  it("sends them back to the topic they moved on to, not the one the slot names", async () => {
    const { studentId, second } = await studentMidPeriod({ minutesSpent: 12 });
    // They passed the first topic's test and started the second inside the same period.
    await prisma.lessonAttempt.create({
      data: { studentId, lessonId: second.id, attemptNumber: 1, timeSpentSeconds: 3 * 60 },
    });

    const resume = await unfinishedPeriod(studentId, TODAY);
    expect(resume!.lessonId).toBe(second.id);
  });

  it("lets them go once the period has genuinely run its course", async () => {
    const { studentId } = await studentMidPeriod({ minutesSpent: 46 });
    expect(await unfinishedPeriod(studentId, TODAY)).toBeNull();
  });

  it("does not settle a lesson out from under a running period", async () => {
    // The second way out: answer the quiz, wait five minutes, and the board closed it for you.
    const { studentId, attempt } = await studentMidPeriod({ minutesSpent: 12 });
    await prisma.activityAttempt.create({
      data: {
        lessonAttemptId: attempt.id,
        stage: "CHECK",
        attemptNumber: 1,
        status: "GRADED",
        gradedAt: new Date(Date.now() - 30 * 60 * 1000),
        score: 4,
        maxScore: 4,
        percentage: 100,
      },
    });

    expect(await settleFinishedLessons(studentId)).toBe(0);
    const still = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(still.status).toBe("IN_PROGRESS");
  });

  it("still settles one whose period is over", async () => {
    const { studentId, attempt } = await studentMidPeriod({ minutesSpent: 50 });
    await prisma.activityAttempt.create({
      data: {
        lessonAttemptId: attempt.id,
        stage: "CHECK",
        attemptNumber: 1,
        status: "GRADED",
        gradedAt: new Date(Date.now() - 30 * 60 * 1000),
        score: 4,
        maxScore: 4,
        percentage: 100,
      },
    });

    expect(await settleFinishedLessons(studentId)).toBe(1);
  });
});
