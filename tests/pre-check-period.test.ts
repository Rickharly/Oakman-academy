import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { judgePreCheck } from "@/lib/lessons/pre-check";
import { toDateOnly, schoolDayKey } from "@/lib/dates";

/**
 * Passing a pre-check used to end the period: the slot was ticked and the child was free.
 *
 * Two things went wrong with that. Pass four of them in ten minutes and the board is all green
 * ticks with an empty day behind it — and the planner, seeing a full day, adds nothing. And the
 * attempt for the skipped lesson was deliberately left open, so opening that ticked lesson
 * later dropped a child onto a dead Feedback screen with the period lock on and nothing to do.
 */
const TODAY = schoolDayKey();

async function studentWithSequence() {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: "eva", passwordHash: "x", displayName: "Eva" },
  });
  const student = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 7, keyStage: "ks3", lessonsPerDay: 5, lessonMinutes: 45 },
  });
  const subject = await prisma.subject.create({ data: { provider: "test", slug: "maths", title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { provider: "test", providerSlug: "maths:7", subjectId: subject.id, yearGroup: 7, keyStage: "ks3", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { provider: "test", providerSlug: "u1", programmeId: programme.id, title: "U", order: 1 },
  });
  const lessons = [];
  for (let i = 1; i <= 3; i++) {
    lessons.push(
      await prisma.lesson.create({
        data: { provider: "test", providerSlug: `l${i}`, unitId: unit.id, title: `Topic ${i}`, order: i },
      }),
    );
  }
  const assignment = await prisma.dailyAssignment.create({
    data: {
      studentId: student.id,
      date: toDateOnly(TODAY),
      order: 0,
      kind: "LESSON",
      subjectId: subject.id,
      lessonId: lessons[0].id,
      estimatedMinutes: 45,
      source: "AUTO",
      status: "PLANNED",
    },
  });
  // The page always opens an attempt before it offers the pre-check.
  const attempt = await prisma.lessonAttempt.create({
    data: { studentId: student.id, lessonId: lessons[0].id, assignmentId: assignment.id, attemptNumber: 1 },
  });
  return { studentId: student.id, lessons, assignment, attempt };
}

describe("passing a pre-check", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("moves the period on to the next topic instead of ending it", async () => {
    const { studentId, lessons, assignment } = await studentWithSequence();

    const outcome = await judgePreCheck({ studentId, lessonId: lessons[0].id, correct: 4, total: 4 });
    expect(outcome.passed).toBe(true);

    const after = await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    // The period is still theirs — pointed at work they have not done.
    expect(after.status).not.toBe("COMPLETED");
    expect(after.lessonId).toBe(lessons[1].id);
  });

  it("closes the attempt it skipped, so nobody lands on a dead feedback screen", async () => {
    const { studentId, lessons, attempt } = await studentWithSequence();

    await judgePreCheck({ studentId, lessonId: lessons[0].id, correct: 4, total: 4 });

    const after = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    // Both "mastered" and "in progress" is what put a child on Feedback for a lesson never sat.
    expect(after.status).not.toBe("IN_PROGRESS");
    expect(after.currentStage).toBe("COMPLETE");
  });

  it("still records that they know it, so it is never taught again", async () => {
    const { studentId, lessons } = await studentWithSequence();

    await judgePreCheck({ studentId, lessonId: lessons[0].id, correct: 4, total: 4 });

    const progress = await prisma.studentLessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId, lessonId: lessons[0].id } },
    });
    expect(progress.status).toBe("MASTERED");
    expect(progress.completedAt).not.toBeNull();
  });

  it("closes the slot only when there is genuinely nothing left to move them to", async () => {
    const { studentId, lessons, assignment } = await studentWithSequence();
    // Everything else already done.
    for (const lesson of lessons.slice(1)) {
      await prisma.studentLessonProgress.create({
        data: { studentId, lessonId: lesson.id, status: "COMPLETED", completedAt: new Date() },
      });
    }

    await judgePreCheck({ studentId, lessonId: lessons[0].id, correct: 4, total: 4 });

    const after = await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(after.status).toBe("COMPLETED");
  });
});
