import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { nextNewLesson } from "@/lib/lessons/sameness";
import { ensureDayPlanned } from "@/lib/scheduling/planner";
import { toDateOnly, weekStartKey } from "@/lib/dates";

/**
 * "A child can go through the lesson, complete it, go to the next lesson, and the lesson is
 * absolutely the same."
 *
 * The next-topic button took the next row by order and nothing else, so a second row of the same
 * lesson — Oak's copy and ours, sitting next to each other — was handed straight back to them.
 */
const MONDAY = weekStartKey("2026-09-07");

async function programmeWithATwin() {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: "eva", passwordHash: "x", displayName: "Eva" },
  });
  const student = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 7, keyStage: "ks3", lessonsPerDay: 1, lessonMinutes: 45 },
  });
  const subject = await prisma.subject.create({ data: { provider: "oak", slug: "maths", title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { provider: "oak", providerSlug: "maths:7", subjectId: subject.id, yearGroup: 7, keyStage: "ks3", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { provider: "oak", providerSlug: "fractions", programmeId: programme.id, title: "Fractions", order: 1 },
  });

  const adding = await prisma.lesson.create({
    data: {
      provider: "oak",
      providerSlug: "adding-fractions",
      unitId: unit.id,
      title: "Adding fractions",
      order: 1,
      keyLearningPoints: [
        "Fractions with the same denominator are added by adding the numerators.",
        "The denominator stays the same when adding fractions.",
        "Simplify the answer where you can.",
      ],
    },
  });
  // The twin: same teaching, different row, different name, sitting next in order.
  const twin = await prisma.lesson.create({
    data: {
      provider: "oakman",
      providerSlug: "fractions-total",
      unitId: unit.id,
      title: "Fractions: finding the total",
      order: 2,
      keyLearningPoints: [
        "When the denominator is the same, add the numerators.",
        "The denominator does not change when adding.",
        "Simplify the answer if possible.",
      ],
    },
  });
  const multiplying = await prisma.lesson.create({
    data: {
      provider: "oak",
      providerSlug: "multiplying-fractions",
      unitId: unit.id,
      title: "Multiplying fractions",
      order: 3,
      keyLearningPoints: ["Multiply the numerators together.", "Multiply the denominators together."],
    },
  });

  await prisma.studentEnrolment.create({ data: { studentId: student.id, programmeId: programme.id } });
  await prisma.studentSchedule.create({
    data: { studentId: student.id, subjectId: subject.id, weeklyFrequency: 5, priority: 5 },
  });
  return { studentId: student.id, adding, twin, multiplying };
}

describe("the next lesson is new", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("skips a twin of the lesson just finished and moves on to something new", async () => {
    const { studentId, adding, multiplying } = await programmeWithATwin();
    await prisma.studentLessonProgress.create({
      data: { studentId, lessonId: adding.id, status: "COMPLETED", completedAt: new Date() },
    });

    const next = await nextNewLesson(studentId, adding.id);
    // Not the twin sitting next in order — the next lesson that actually teaches something new.
    expect(next?.id).toBe(multiplying.id);
  });

  it("skips the twin even before the finished lesson has been recorded as done", async () => {
    // "Start the next topic" is offered from the feedback screen, which can come before the
    // finished lesson is written up as done. The lesson being left is never the next one.
    const { studentId, adding, multiplying } = await programmeWithATwin();

    const next = await nextNewLesson(studentId, adding.id);
    expect(next?.id).toBe(multiplying.id);
  });

  it("says there is nothing left rather than offering a repeat", async () => {
    const { studentId, adding, multiplying } = await programmeWithATwin();
    for (const lesson of [adding, multiplying]) {
      await prisma.studentLessonProgress.create({
        data: { studentId, lessonId: lesson.id, status: "COMPLETED", completedAt: new Date() },
      });
    }

    expect(await nextNewLesson(studentId, multiplying.id)).toBeNull();
  });

  it("never plans the twin of a lesson already taught", async () => {
    const { studentId, adding, twin } = await programmeWithATwin();
    await prisma.studentLessonProgress.create({
      data: { studentId, lessonId: adding.id, status: "COMPLETED", completedAt: new Date() },
    });

    await ensureDayPlanned(studentId, MONDAY);

    const planned = await prisma.dailyAssignment.findMany({
      where: { studentId, date: toDateOnly(MONDAY), kind: "LESSON" },
    });
    expect(planned.map((a) => a.lessonId)).not.toContain(twin.id);
  });

  it("takes a repeat already sitting on the board off it, and fills the slot with something new", async () => {
    // Planned before the rule existed: the twin of a lesson she has since finished.
    const { studentId, adding, twin, multiplying } = await programmeWithATwin();
    const subject = await prisma.subject.findFirstOrThrow({ where: { slug: "maths" } });
    await prisma.studentLessonProgress.create({
      data: { studentId, lessonId: adding.id, status: "COMPLETED", completedAt: new Date() },
    });
    const stale = await prisma.dailyAssignment.create({
      data: {
        studentId,
        date: toDateOnly(MONDAY),
        order: 0,
        kind: "LESSON",
        subjectId: subject.id,
        lessonId: twin.id,
        estimatedMinutes: 45,
        source: "AUTO",
      },
    });

    await ensureDayPlanned(studentId, MONDAY);

    expect(await prisma.dailyAssignment.findUnique({ where: { id: stale.id } })).toBeNull();
    const today = await prisma.dailyAssignment.findMany({
      where: { studentId, date: toDateOnly(MONDAY), kind: "LESSON" },
    });
    expect(today.map((a) => a.lessonId)).toContain(multiplying.id);
  });

  it("never removes a repeat the child has already started", async () => {
    const { studentId, adding, twin } = await programmeWithATwin();
    const subject = await prisma.subject.findFirstOrThrow({ where: { slug: "maths" } });
    await prisma.studentLessonProgress.create({
      data: { studentId, lessonId: adding.id, status: "COMPLETED", completedAt: new Date() },
    });
    const started = await prisma.dailyAssignment.create({
      data: {
        studentId,
        date: toDateOnly(MONDAY),
        order: 0,
        kind: "LESSON",
        subjectId: subject.id,
        lessonId: twin.id,
        estimatedMinutes: 45,
        source: "AUTO",
        status: "IN_PROGRESS",
      },
    });

    await ensureDayPlanned(studentId, MONDAY);
    // Work they began is theirs, repeat or not.
    expect(await prisma.dailyAssignment.findUnique({ where: { id: started.id } })).not.toBeNull();
  });

  it("plans only one of two twins that are both still to do", async () => {
    const { studentId, adding, twin } = await programmeWithATwin();

    // Plan the whole week, so both twins would be reached if both were eligible.
    for (let day = 0; day < 5; day++) {
      const date = new Date(toDateOnly(MONDAY).getTime() + day * 86_400_000);
      await ensureDayPlanned(studentId, date.toISOString().slice(0, 10));
    }

    const planned = await prisma.dailyAssignment.findMany({
      where: { studentId, kind: "LESSON", lessonId: { in: [adding.id, twin.id] } },
    });
    expect(planned).toHaveLength(1);
  });
});
