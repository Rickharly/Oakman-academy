import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { moveToNextLesson } from "@/lib/lessons/parent-move";
import { startOrResumeAttempt, unfinishedPeriod } from "@/lib/lessons/service";
import { schoolDayKey, toDateOnly } from "@/lib/dates";

/** "Give me a setting where I can just click a new lesson for him." */
describe("a parent moves their child on to the next lesson", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("closes the lesson on screen and points today's period at the next new one", async () => {
    const user = await prisma.user.create({
      data: { role: "STUDENT", username: "mikhael", passwordHash: "x", displayName: "Mikhael" },
    });
    const student = await prisma.studentProfile.create({ data: { userId: user.id, yearGroup: 4, keyStage: "ks2" } });
    const subject = await prisma.subject.create({ data: { provider: "oak", slug: "maths", title: "Maths" } });
    const programme = await prisma.programme.create({
      data: { provider: "oak", providerSlug: "maths:4", subjectId: subject.id, yearGroup: 4, keyStage: "ks2", title: "Maths" },
    });
    const unit = await prisma.unit.create({
      data: { provider: "oak", providerSlug: "u", programmeId: programme.id, title: "Multiplication", order: 1 },
    });
    const a = await prisma.lesson.create({
      data: { provider: "oak", providerSlug: "a", unitId: unit.id, title: "Explain what each factor represents", order: 1 },
    });
    const b = await prisma.lesson.create({
      data: { provider: "oak", providerSlug: "b", unitId: unit.id, title: "Multiply three numbers together", order: 2 },
    });
    const slot = await prisma.dailyAssignment.create({
      data: {
        studentId: student.id,
        date: toDateOnly(schoolDayKey()),
        kind: "LESSON",
        subjectId: subject.id,
        lessonId: a.id,
        estimatedMinutes: 48,
        order: 0,
        source: "AUTO",
      },
    });
    await startOrResumeAttempt(student.id, a.id, slot.id);

    const result = await moveToNextLesson(student.id);

    expect(result.moved).toBe(true);
    expect(result.toTitle).toBe(b.title);
    const attempt = await prisma.lessonAttempt.findFirstOrThrow({ where: { studentId: student.id, lessonId: a.id } });
    expect(attempt.status).not.toBe("IN_PROGRESS"); // their open lesson sees this and moves on
    expect((await unfinishedPeriod(student.id, schoolDayKey()))?.lessonId).toBe(b.id);
  });
});
