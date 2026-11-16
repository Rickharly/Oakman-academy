import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { swapRepeatInSlot } from "@/lib/lessons/repeat-guard";
import { schoolDayKey, schoolDayStart, toDateOnly } from "@/lib/dates";

/** "The maths lesson was the same." Opening yesterday's lesson from today's board swaps it. */
async function build() {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: "mikhael", passwordHash: "x", displayName: "Mikhael" },
  });
  const student = await prisma.studentProfile.create({ data: { userId: user.id, yearGroup: 4, keyStage: "ks2" } });
  const subject = await prisma.subject.create({ data: { provider: "oak", slug: "maths", title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { provider: "oak", providerSlug: "maths:4", subjectId: subject.id, yearGroup: 4, keyStage: "ks2", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { provider: "oak", providerSlug: "u1", programmeId: programme.id, title: "Multiplication", order: 1 },
  });
  const lessons = [];
  for (const [i, title] of ["Times tables for 6", "Times tables for 7", "Times tables for 8"].entries()) {
    lessons.push(
      await prisma.lesson.create({
        data: { provider: "oak", providerSlug: `l${i}`, unitId: unit.id, title, order: i + 1 },
      }),
    );
  }
  const day = schoolDayKey();
  const slot = await prisma.dailyAssignment.create({
    data: {
      studentId: student.id,
      date: toDateOnly(day),
      kind: "LESSON",
      subjectId: subject.id,
      lessonId: lessons[0].id,
      estimatedMinutes: 45,
      order: 0,
      source: "AUTO",
    },
  });
  return { studentId: student.id, lessons, slot, dayStart: schoolDayStart(day) };
}

describe("a lesson already done on an earlier day", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("is swapped for the next new one when opened from today's board", async () => {
    const { studentId, lessons, slot, dayStart } = await build();
    await prisma.studentLessonProgress.create({
      data: { studentId, lessonId: lessons[0].id, status: "COMPLETED", completedAt: new Date(dayStart.getTime() - 86_400_000) },
    });

    expect(await swapRepeatInSlot(studentId, lessons[0].id, slot.id, dayStart)).toBe(lessons[1].id);
    expect((await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: slot.id } })).lessonId).toBe(lessons[1].id);
  });

  it("leaves a new lesson alone", async () => {
    const { studentId, lessons, slot, dayStart } = await build();
    expect(await swapRepeatInSlot(studentId, lessons[0].id, slot.id, dayStart)).toBeNull();
  });

  it("leaves alone a lesson they are in the middle of today", async () => {
    const { studentId, lessons, slot, dayStart } = await build();
    await prisma.studentLessonProgress.create({
      data: { studentId, lessonId: lessons[0].id, status: "COMPLETED", completedAt: new Date(dayStart.getTime() - 86_400_000) },
    });
    await prisma.lessonAttempt.create({
      data: { studentId, lessonId: lessons[0].id, attemptNumber: 2, status: "IN_PROGRESS", currentStage: "LEARN" },
    });
    expect(await swapRepeatInSlot(studentId, lessons[0].id, slot.id, dayStart)).toBeNull();
  });
});
