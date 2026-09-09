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

describe("planner: a day that came out doubled", () => {
  beforeAll(async () => {
    await resetDb();
    studentId = await buildStudentWithCurriculum(12);
  });

  it("cuts a doubled day back to the timetable", async () => {
    // Exactly how it happens in production: two plans racing, each picking different lessons.
    await Promise.all([planWeek(studentId, MONDAY), planWeek(studentId, MONDAY)]);
    const doubled = await lessonsOn(MONDAY);
    // Whatever the race produced, opening Today must leave a normal day.
    await ensureDayPlanned(studentId, MONDAY);

    const after = await lessonsOn(MONDAY);
    expect(after).toHaveLength(5);
    expect(after.length).toBeLessThanOrEqual(doubled.length);
  });

  it("never deletes a lesson the child has already started", async () => {
    await prisma.dailyAssignment.deleteMany({ where: { studentId } });
    await planWeek(studentId, MONDAY);
    const [first, second] = await lessonsOn(MONDAY);
    await prisma.dailyAssignment.update({ where: { id: first.id }, data: { status: "IN_PROGRESS" } });
    await prisma.dailyAssignment.update({ where: { id: second.id }, data: { status: "COMPLETED" } });

    // Force the day over the cap with extra planned lessons.
    const spare = await prisma.lesson.findMany({ take: 4, orderBy: { providerSlug: "desc" } });
    for (const [i, lesson] of spare.entries()) {
      await prisma.dailyAssignment.create({
        data: {
          studentId,
          date: toDateOnly(MONDAY),
          order: 50 + i,
          kind: "LESSON",
          source: "AUTO",
          lessonId: lesson.id,
          subjectId: first.subjectId,
          estimatedMinutes: 45,
        },
      });
    }

    await ensureDayPlanned(studentId, MONDAY);
    const after = await lessonsOn(MONDAY);
    expect(after.some((a) => a.id === first.id)).toBe(true);
    expect(after.some((a) => a.id === second.id)).toBe(true);
  });
});

describe("planner: a student added through Settings", () => {
  it("enrols them the first time anything plans for them", async () => {
    await resetDb();
    // Build the curriculum, then a student with an account and nothing else — exactly what
    // "add a student" used to produce.
    await buildStudentWithCurriculum(12);
    const user = await prisma.user.create({
      data: { role: "STUDENT", username: "brand-new", passwordHash: "x", displayName: "New" },
    });
    const profile = await prisma.studentProfile.create({
      data: { userId: user.id, yearGroup: 7, keyStage: "ks3" },
    });

    expect(await prisma.studentEnrolment.count({ where: { studentId: profile.id } })).toBe(0);

    const day = await ensureDayPlanned(profile.id, MONDAY);

    expect(await prisma.studentEnrolment.count({ where: { studentId: profile.id } })).toBeGreaterThan(0);
    expect(day.filter((a) => a.kind === "LESSON")).toHaveLength(5);
  });
});

describe("planner: a day never repeats a subject", () => {
  beforeAll(async () => {
    await resetDb();
    // Only two subjects have any lessons at all. This is the real shape of the problem: the
    // rest of the timetable has nothing imported yet.
    const user = await prisma.user.create({
      data: { role: "STUDENT", username: "starved", passwordHash: "x", displayName: "Eva" },
    });
    const profile = await prisma.studentProfile.create({
      data: { userId: user.id, yearGroup: 7, keyStage: "ks3", lessonsPerDay: 5 },
    });
    studentId = profile.id;

    for (const slug of ["maths", "english"] as const) {
      const subject = await prisma.subject.create({ data: { provider: "test", slug, title: slug } });
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
        data: { provider: "test", providerSlug: `${slug}-u`, programmeId: programme.id, title: "U", order: 1 },
      });
      for (let i = 1; i <= 20; i++) {
        await prisma.lesson.create({
          data: {
            provider: "test",
            providerSlug: `${slug}-x${i}`,
            unitId: unit.id,
            title: `${slug} ${i}`,
            order: i,
          },
        });
      }
      await prisma.studentEnrolment.create({ data: { studentId: profile.id, programmeId: programme.id } });
      await prisma.studentSchedule.create({
        data: { studentId: profile.id, subjectId: subject.id, weeklyFrequency: 5, priority: 1 },
      });
    }
    await planWeek(studentId, MONDAY, { replace: true });
  });

  it("gives a short day rather than three maths lessons", async () => {
    for (let i = 0; i < 5; i++) {
      const lessons = await lessonsOn(addDaysKey(MONDAY, i));
      const subjects = lessons.map((l) => l.subject?.title);
      // Two subjects have material, so the day is two periods — not five made of three maths.
      // Four periods of the same subject is not a school day, and a child rightly asks why.
      expect(new Set(subjects).size).toBe(subjects.length);
      expect(lessons).toHaveLength(2);
    }
  });

  it("repairs a day that was already saved with the same subject twice", async () => {
    const day = toDateOnly(addDaysKey(MONDAY, 0));
    const maths = await prisma.subject.findFirstOrThrow({ where: { slug: "maths" } });
    const spare = await prisma.lesson.findFirstOrThrow({ where: { providerSlug: "maths-x19" } });
    await prisma.dailyAssignment.create({
      data: {
        studentId,
        date: day,
        order: 9,
        kind: "LESSON",
        subjectId: maths.id,
        lessonId: spare.id,
        estimatedMinutes: 45,
        source: "AUTO",
      },
    });

    await ensureDayPlanned(studentId, addDaysKey(MONDAY, 0));

    const lessons = await lessonsOn(addDaysKey(MONDAY, 0));
    const subjects = lessons.map((l) => l.subject?.title);
    expect(new Set(subjects).size).toBe(subjects.length);
  });
});

describe("planner: a subject that has run out", () => {
  beforeAll(async () => {
    await resetDb();
    studentId = await buildStudentWithCurriculum(2);
    // Both maths lessons already done, so maths has nothing new to give.
    const mathsLessons = await prisma.lesson.findMany({ where: { providerSlug: { startsWith: "maths-" } } });
    for (const lesson of mathsLessons) {
      await prisma.studentLessonProgress.create({
        data: { studentId, lessonId: lesson.id, status: "COMPLETED" },
      });
    }
    await planWeek(studentId, MONDAY, { replace: true });
  });

  it("leaves the day short rather than teaching another subject twice", async () => {
    const lessons = await lessonsOn(MONDAY);
    const subjects = lessons.map((l) => l.subject?.title);
    // Four subjects still have material, so four periods. Never five made by repeating one —
    // and never padded with revision, which is not a lesson and reads as filler.
    expect(new Set(subjects).size).toBe(subjects.length);
    expect(lessons.length).toBe(4);
  });

  it("does not add anything on a second visit", async () => {
    const before = await prisma.dailyAssignment.count({
      where: { studentId, date: toDateOnly(MONDAY), status: { not: "MOVED" } },
    });
    await ensureDayPlanned(studentId, MONDAY);
    const after = await prisma.dailyAssignment.count({
      where: { studentId, date: toDateOnly(MONDAY), status: { not: "MOVED" } },
    });
    expect(after).toBe(before);
  });
});
