import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { completeStage, recordTime, startOrResumeAttempt, submitStage, unfinishedPeriod } from "@/lib/lessons/service";
import { ensureFullSchoolDay, PERIOD_MINUTES, PERIODS_PER_DAY } from "@/lib/admin/timetable";
import { schoolDayKey, toDateOnly } from "@/lib/dates";

/**
 * "They finish all lessons in like 2h. They should study at least 4h, even if they are smart."
 *
 * Five periods of 48 minutes of real study. Finishing a topic early does not end the period:
 * the board waits for the time, and coming back to Today goes on to the next new topic.
 */
async function build() {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: "mikhael", passwordHash: "x", displayName: "Mikhael" },
  });
  const student = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 4, keyStage: "ks2", lessonMinutes: 45, lessonsPerDay: 4 },
  });
  const subject = await prisma.subject.create({ data: { provider: "oak", slug: "maths", title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { provider: "oak", providerSlug: "maths:4", subjectId: subject.id, yearGroup: 4, keyStage: "ks2", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { provider: "oak", providerSlug: "u1", programmeId: programme.id, title: "Number", order: 1 },
  });
  const lessons = [];
  for (const [i, title] of ["Place value to 10,000", "Rounding to the nearest 1,000", "Roman numerals to 100"].entries()) {
    lessons.push(
      await prisma.lesson.create({
        data: { provider: "oak", providerSlug: `l${i}`, unitId: unit.id, title, order: i + 1, keyLearningPoints: [`${title} idea`] },
      }),
    );
  }
  const slot = await prisma.dailyAssignment.create({
    data: {
      studentId: student.id,
      date: toDateOnly(schoolDayKey()),
      kind: "LESSON",
      subjectId: subject.id,
      lessonId: lessons[0].id,
      estimatedMinutes: 48,
      order: 0,
      source: "AUTO",
    },
  });
  return { studentId: student.id, lessons, slot };
}

/** Real study time, reported the way the page does: in slices, each well under the cap. */
async function study(studentId: string, attemptId: string, minutes: number) {
  for (let left = minutes * 60; left > 0; left -= 300) await recordTime(attemptId, studentId, Math.min(300, left));
}

async function finish(studentId: string, attemptId: string) {
  await prisma.lessonAttempt.update({ where: { id: attemptId }, data: { currentStage: "CHECK" } });
  await submitStage(attemptId, studentId, "CHECK");
  await completeStage(attemptId, studentId, "FEEDBACK");
  await completeStage(attemptId, studentId, "COMPLETE");
}

describe("four hours of real study a day", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("is five periods of 48 minutes, and every child is brought up to it", async () => {
    expect(PERIODS_PER_DAY * PERIOD_MINUTES).toBe(240);
    const { studentId } = await build();
    await ensureFullSchoolDay(studentId);
    const after = await prisma.studentProfile.findUniqueOrThrow({ where: { id: studentId } });
    expect(after.lessonMinutes).toBe(48);
    expect(after.lessonsPerDay).toBe(5);
  });

  it("a topic finished in twenty minutes does not tick the period, and Today goes on to the next topic", async () => {
    const { studentId, lessons, slot } = await build();
    await ensureFullSchoolDay(studentId);
    const attempt = await startOrResumeAttempt(studentId, lessons[0].id, slot.id);
    await study(studentId, attempt.id, 20);
    await finish(studentId, attempt.id);

    const board = await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: slot.id } });
    expect(board.status).toBe("IN_PROGRESS");

    const resume = await unfinishedPeriod(studentId, schoolDayKey());
    expect(resume?.lessonId).toBe(lessons[1].id);
  });

  it("ticks the period the moment 48 minutes of real study are served, whichever topic they are on", async () => {
    const { studentId, lessons, slot } = await build();
    await ensureFullSchoolDay(studentId);
    const first = await startOrResumeAttempt(studentId, lessons[0].id, slot.id);
    await study(studentId, first.id, 25);
    await finish(studentId, first.id);

    const second = await startOrResumeAttempt(studentId, lessons[1].id, slot.id);
    expect(second.assignmentId).toBe(slot.id);
    await study(studentId, second.id, 23);

    const board = await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: slot.id } });
    expect(board.status).toBe("COMPLETED");
    expect(await unfinishedPeriod(studentId, schoolDayKey())).toBeNull();
  });
});
