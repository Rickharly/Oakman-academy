import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { planWeek, ensureDayPlanned, getTodayView } from "@/lib/scheduling/planner";
import { addDaysKey, toDateOnly, weekStartKey } from "@/lib/dates";

/**
 * The timetable is the promise the school makes to the family: five 45-minute periods every
 * weekday, separated by breaks. These tests hold the planner to that.
 */
const SUBJECTS = ["maths", "english", "science", "history", "geography"] as const;
const MONDAY = weekStartKey("2026-09-07"); // a known Monday

let studentId: string;

async function buildStudentWithCurriculum(lessonsPerSubject: number) {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: "tester", passwordHash: "x", displayName: "Tester" },
  });
  const profile = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 7, keyStage: "ks3" },
  });

  for (const slug of SUBJECTS) {
    const subject = await prisma.subject.create({
      data: { provider: "test", slug, title: slug },
    });
    const programme = await prisma.programme.create({
      data: {
        provider: "test",
        providerSlug: `${slug}:7`,
        subjectId: subject.id,
        yearGroup: 7,
        keyStage: "ks3",
        title: slug,
      },
    });
    const unit = await prisma.unit.create({
      data: { provider: "test", providerSlug: `${slug}-u1`, programmeId: programme.id, title: "Unit", order: 1 },
    });
    for (let i = 1; i <= lessonsPerSubject; i++) {
      await prisma.lesson.create({
        data: {
          provider: "test",
          providerSlug: `${slug}-l${i}`,
          unitId: unit.id,
          title: `${slug} lesson ${i}`,
          order: i,
          // Deliberately not 45: the timetable must impose the period length, not the content.
          estimatedMinutes: 60,
        },
      });
    }
    await prisma.studentEnrolment.create({ data: { studentId: profile.id, programmeId: programme.id } });
    await prisma.studentSchedule.create({
      data: { studentId: profile.id, subjectId: subject.id, weeklyFrequency: 5, priority: 1 },
    });
  }

  return profile.id;
}

async function lessonsOn(dayKey: string) {
  return prisma.dailyAssignment.findMany({
    where: { studentId, date: toDateOnly(dayKey), kind: "LESSON", status: { not: "MOVED" } },
    include: { subject: true },
    orderBy: { order: "asc" },
  });
}

describe("planner: the weekly timetable", () => {
  beforeAll(async () => {
    await resetDb();
    studentId = await buildStudentWithCurriculum(12);
    await planWeek(studentId, MONDAY, { replace: true });
  });

  it("plans five lessons on every weekday", async () => {
    for (let i = 0; i < 5; i++) {
      const lessons = await lessonsOn(addDaysKey(MONDAY, i));
      expect(lessons).toHaveLength(5);
    }
  });

  it("gives every period the timetable's length, not the lesson's own estimate", async () => {
    const lessons = await lessonsOn(MONDAY);
    expect(lessons.every((l) => l.estimatedMinutes === 45)).toBe(true);
    // Five periods of 45 minutes is 3h45 of teaching.
    expect(lessons.reduce((n, l) => n + l.estimatedMinutes, 0)).toBe(225);
  });

  it("spreads the subjects so a day is not the same subject repeated", async () => {
    const lessons = await lessonsOn(MONDAY);
    const slugs = lessons.map((l) => l.subject?.slug);
    expect(new Set(slugs).size).toBe(5);
  });

  it("never schedules the same lesson twice in a week", async () => {
    const all = await prisma.dailyAssignment.findMany({
      where: { studentId, kind: "LESSON", status: { not: "MOVED" } },
      select: { lessonId: true },
    });
    const ids = all.map((a) => a.lessonId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("plans nothing at the weekend", async () => {
    const saturday = await ensureDayPlanned(studentId, addDaysKey(MONDAY, 5));
    expect(saturday).toHaveLength(0);
  });

  it("is idempotent — re-planning does not duplicate the day", async () => {
    const before = await lessonsOn(MONDAY);
    await planWeek(studentId, MONDAY);
    const after = await lessonsOn(MONDAY);
    expect(after).toHaveLength(before.length);
  });

  it("reports the day to the student as five lessons", async () => {
    const view = await getTodayView(studentId, MONDAY);
    expect(view.assignments.filter((a) => a.kind === "LESSON")).toHaveLength(5);
    expect(view.totalMinutes).toBe(225);
  });
});

describe("planner: when a subject runs out of lessons", () => {
  beforeAll(async () => {
    await resetDb();
    // Only one lesson per subject: the week cannot be filled, and that must not loop forever
    // or invent repeats.
    studentId = await buildStudentWithCurriculum(1);
    await planWeek(studentId, MONDAY, { replace: true });
  });

  it("plans what exists and stops, without repeating a lesson", async () => {
    const all = await prisma.dailyAssignment.findMany({
      where: { studentId, kind: "LESSON", status: { not: "MOVED" } },
      select: { lessonId: true },
    });
    expect(all.length).toBe(5); // five subjects × one lesson each
    expect(new Set(all.map((a) => a.lessonId)).size).toBe(5);
  });
});

describe("planner: a day left short", () => {
  beforeAll(async () => {
    await resetDb();
    studentId = await buildStudentWithCurriculum(12);
  });

  it("tops up a day that has only one lesson instead of leaving it broken", async () => {
    await planWeek(studentId, MONDAY, { replace: true });
    const before = await lessonsOn(MONDAY);
    expect(before).toHaveLength(5);

    // Simulate the state a child was actually left in: all but one period gone.
    await prisma.dailyAssignment.deleteMany({
      where: { studentId, id: { in: before.slice(1).map((a) => a.id) } },
    });
    expect(await lessonsOn(MONDAY)).toHaveLength(1);

    // Opening Today must repair the day, not shrug at it.
    await ensureDayPlanned(studentId, MONDAY);
    expect(await lessonsOn(MONDAY)).toHaveLength(5);
  });

  it("does not add a sixth lesson to a day that is already full", async () => {
    await ensureDayPlanned(studentId, MONDAY);
    await ensureDayPlanned(studentId, MONDAY);
    expect(await lessonsOn(MONDAY)).toHaveLength(5);
  });

  it("keeps the lesson they had already started", async () => {
    const [first] = await lessonsOn(MONDAY);
    await prisma.dailyAssignment.update({ where: { id: first.id }, data: { status: "IN_PROGRESS" } });
    await prisma.dailyAssignment.deleteMany({
      where: { studentId, date: toDateOnly(MONDAY), status: "PLANNED", kind: "LESSON" },
    });

    await ensureDayPlanned(studentId, MONDAY);
    const after = await lessonsOn(MONDAY);
    expect(after).toHaveLength(5);
    expect(after.some((a) => a.id === first.id && a.status === "IN_PROGRESS")).toBe(true);
  });
});
