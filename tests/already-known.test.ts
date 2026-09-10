import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { markAlreadyLearned } from "@/lib/lessons/already-known";
import { ensureDayPlanned } from "@/lib/scheduling/planner";
import { buildAcademicRecord } from "@/lib/records/academic-record";
import { weekStartKey, toDateOnly } from "@/lib/dates";

/**
 * A child saying they have already been taught a lesson.
 *
 * It has to do two things that pull against each other: believe them enough to take the lesson
 * off their day, and not write anything into their record that nobody watched them earn.
 */
const MONDAY = weekStartKey("2026-09-07");

async function build() {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: "eva", passwordHash: "x", displayName: "Eva" },
  });
  const student = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 7, keyStage: "ks3", lessonsPerDay: 1 },
  });
  const subject = await prisma.subject.create({ data: { provider: "test", slug: "maths", title: "Maths" } });
  const programme = await prisma.programme.create({
    data: {
      provider: "test",
      providerSlug: "maths:7",
      subjectId: subject.id,
      yearGroup: 7,
      keyStage: "ks3",
      title: "Maths",
    },
  });
  const unit = await prisma.unit.create({
    data: { provider: "test", providerSlug: "u1", programmeId: programme.id, title: "Unit", order: 1 },
  });
  const lessons = [];
  for (let i = 1; i <= 3; i++) {
    lessons.push(
      await prisma.lesson.create({
        data: { provider: "test", providerSlug: `l${i}`, unitId: unit.id, title: `Lesson ${i}`, order: i },
      }),
    );
  }
  await prisma.studentEnrolment.create({ data: { studentId: student.id, programmeId: programme.id } });
  await prisma.studentSchedule.create({
    data: { studentId: student.id, subjectId: subject.id, weeklyFrequency: 5, priority: 1 },
  });
  return { studentId: student.id, lessons };
}

describe("I've already learned this", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("takes it off the day, and never sets it again", async () => {
    const { studentId, lessons } = await build();

    await markAlreadyLearned(studentId, lessons[0].id, { note: "did it last year" });

    const progress = await prisma.studentLessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId, lessonId: lessons[0].id } },
    });
    expect(progress.status).toBe("ALREADY_KNOWN");
    // Nothing was assessed, so nothing is claimed. A mark we did not measure is a lie.
    expect(progress.bestScorePct).toBeNull();
    expect(progress.mastery).toBeNull();

    await ensureDayPlanned(studentId, MONDAY);
    const planned = await prisma.dailyAssignment.findMany({
      where: { studentId, date: toDateOnly(MONDAY), kind: "LESSON" },
    });
    expect(planned.map((a) => a.lessonId)).not.toContain(lessons[0].id);
  });

  it("says so when they are right, so a repeat gets chased", async () => {
    const { studentId, lessons } = await build();
    // The same lesson under a different row — the shape the repeats actually took.
    const other = await prisma.lesson.create({
      data: {
        provider: "other",
        providerSlug: "dup",
        unitId: lessons[0].unitId,
        title: "Lesson 1",
        order: 9,
      },
    });
    await prisma.studentLessonProgress.create({
      data: { studentId, lessonId: other.id, status: "COMPLETED", completedAt: new Date() },
    });

    const result = await markAlreadyLearned(studentId, lessons[0].id);
    expect(result.seenBefore).toBe(true);
  });

  it("is not counted as a lesson taught in the record", async () => {
    const { studentId, lessons } = await build();
    await markAlreadyLearned(studentId, lessons[0].id);

    const record = await buildAcademicRecord(studentId);
    const titles = record.subjects.flatMap((s) => s.units.flatMap((u) => u.lessonTitles));
    expect(titles).not.toContain("Lesson 1");
  });

  it("never overwrites work they actually did", async () => {
    const { studentId, lessons } = await build();
    await prisma.studentLessonProgress.create({
      data: {
        studentId,
        lessonId: lessons[0].id,
        status: "MASTERED",
        bestScorePct: 100,
        mastery: 1,
        completedAt: new Date(),
      },
    });

    await markAlreadyLearned(studentId, lessons[0].id);
    const progress = await prisma.studentLessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId, lessonId: lessons[0].id } },
    });
    expect(progress.status).toBe("MASTERED");
    expect(progress.bestScorePct).toBe(100);
  });
});
