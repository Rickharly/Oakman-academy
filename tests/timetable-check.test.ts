import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { timetableCheck } from "@/lib/admin/diagnostics";
import { addDaysKey, dateOnlyKey, todayDateOnly, toDateOnly, weekStartKey } from "@/lib/dates";

/**
 * "Why today looks like this" used to lump four very different states into one alarm — a real
 * supply shortage, a student nobody set up, a week nobody has asked the planner to run yet, and
 * a day that came up short once the planner did run. From a parent's chair all four read as
 * "1 problem(s) stopping lessons being scheduled", which is only true of the first two. These
 * tests hold the check to telling them apart.
 */

const TODAY_KEY = dateOnlyKey(todayDateOnly());

async function makeStudent(displayName: string, opts: { linkParent?: boolean } = {}) {
  const user = await prisma.user.create({
    data: { role: "STUDENT", username: displayName.toLowerCase().replace(/\s+/g, "-"), passwordHash: "x", displayName },
  });
  if (opts.linkParent !== false) {
    const parentUser = await prisma.user.create({
      data: { role: "PARENT", email: `${user.username}-parent@example.com`, passwordHash: "x", displayName: "Parent" },
    });
    await prisma.parentStudentLink.create({ data: { parentId: parentUser.id, studentId: user.id } });
  }
  const profile = await prisma.studentProfile.create({
    data: { userId: user.id, yearGroup: 7, keyStage: "ks3", lessonsPerDay: 5 },
  });
  return profile;
}

async function makeSubjectWithLessons(slug: string, lessonCount: number) {
  const subject = await prisma.subject.create({ data: { provider: "test", slug, title: slug } });
  const programme = await prisma.programme.create({
    data: { provider: "test", providerSlug: `${slug}:7`, subjectId: subject.id, yearGroup: 7, keyStage: "ks3", title: slug },
  });
  const unit = await prisma.unit.create({
    data: { provider: "test", providerSlug: `${slug}-u1`, programmeId: programme.id, title: "Unit", order: 1 },
  });
  for (let i = 1; i <= lessonCount; i++) {
    await prisma.lesson.create({
      data: { provider: "test", providerSlug: `${slug}-l${i}`, unitId: unit.id, title: `${slug} lesson ${i}`, order: i },
    });
  }
  return { subject, programme };
}

describe("timetable check: a real supply problem (case 1)", () => {
  let check: Awaited<ReturnType<typeof timetableCheck>>;

  beforeAll(async () => {
    await resetDb();
    const student = await makeStudent("Rich");

    // Subject A: scheduled but the timetable and the enrolment point at different rows — no
    // programme the planner can see for this subject id.
    const notEnrolled = await prisma.subject.create({ data: { provider: "test", slug: "geography", title: "Geography" } });
    await prisma.studentSchedule.create({
      data: { studentId: student.id, subjectId: notEnrolled.id, weeklyFrequency: 2, priority: 1 },
    });

    // Subject B: enrolled, but every lesson is already done — nothing left to teach.
    const { subject: outOfLessonsSubject, programme: outOfLessonsProgramme } = await makeSubjectWithLessons("maths", 2);
    await prisma.studentEnrolment.create({ data: { studentId: student.id, programmeId: outOfLessonsProgramme.id } });
    await prisma.studentSchedule.create({
      data: { studentId: student.id, subjectId: outOfLessonsSubject.id, weeklyFrequency: 5, priority: 1 },
    });
    const outOfLessonsLessons = await prisma.lesson.findMany({ where: { providerSlug: { startsWith: "maths-" } } });
    for (const lesson of outOfLessonsLessons) {
      await prisma.studentLessonProgress.create({ data: { studentId: student.id, lessonId: lesson.id, status: "COMPLETED" } });
    }

    // Subject C: enrolled, has lessons left, but fewer than the weekly frequency promises —
    // it will run dry partway through this very week.
    const { subject: runningOutSubject, programme: runningOutProgramme } = await makeSubjectWithLessons("science", 5);
    await prisma.studentEnrolment.create({ data: { studentId: student.id, programmeId: runningOutProgramme.id } });
    await prisma.studentSchedule.create({
      data: { studentId: student.id, subjectId: runningOutSubject.id, weeklyFrequency: 5, priority: 1 },
    });
    const scienceLessons = await prisma.lesson.findMany({ where: { providerSlug: { startsWith: "science-" } } });
    // Complete all but two, so two are left against a 5/week timetable.
    for (const lesson of scienceLessons.slice(0, 3)) {
      await prisma.studentLessonProgress.create({ data: { studentId: student.id, lessonId: lesson.id, status: "COMPLETED" } });
    }

    check = await timetableCheck();
  });

  it("fails the check", () => {
    expect(check.status).toBe("fail");
  });

  it("counts all three supply problems in the headline", () => {
    expect(check.summary).toContain("3 problem(s) stopping lessons being scheduled");
  });

  it("names the missing enrolment in words", () => {
    expect(check.detail).toContain("Geography");
    expect(check.detail).toContain("NOT ENROLLED");
  });

  it("names the subject with nothing left to teach", () => {
    expect(check.detail).toContain("NOTHING TO TEACH");
  });

  it("names the subject that will run out before the week is over", () => {
    expect(check.detail).toContain("2 left");
    expect(check.detail).toContain("run out this week");
  });
});

describe("timetable check: a week nobody has planned yet (case 2)", () => {
  let check: Awaited<ReturnType<typeof timetableCheck>>;

  beforeAll(async () => {
    await resetDb();
    const student = await makeStudent("Rich");
    const { subject, programme } = await makeSubjectWithLessons("maths", 40);
    await prisma.studentEnrolment.create({ data: { studentId: student.id, programmeId: programme.id } });
    await prisma.studentSchedule.create({
      data: { studentId: student.id, subjectId: subject.id, weeklyFrequency: 5, priority: 1 },
    });
    // Deliberately: no DailyAssignment rows at all — nobody has opened Today or this child's
    // admin page, and nothing plans on a timer.

    check = await timetableCheck();
  });

  it("does not fail the check — this is not a supply problem", () => {
    expect(check.status).not.toBe("fail");
  });

  it("is reported at a lower severity than a real supply problem", () => {
    expect(check.status).toBe("warn");
  });

  it("does not count towards the headline problem count", () => {
    expect(check.summary).not.toContain("problem(s) stopping lessons being scheduled");
  });

  it("says plainly that nothing has planned this child's week yet", () => {
    expect(check.detail).toContain("NOTHING PLANNED THIS WEEK YET");
  });

  it("names both things that would plan it", () => {
    expect(check.detail).toMatch(/signs in and opens Today/);
    expect(check.detail).toMatch(/Rebuild today's lessons/);
  });
});

describe("timetable check: a student nobody is linked to (case 3)", () => {
  let check: Awaited<ReturnType<typeof timetableCheck>>;

  beforeAll(async () => {
    await resetDb();
    // Plenty of lessons and a normal timetable — the only thing wrong is that no
    // ParentStudentLink row exists for this student's user.
    const student = await makeStudent("Orphan", { linkParent: false });
    const { subject, programme } = await makeSubjectWithLessons("maths", 40);
    await prisma.studentEnrolment.create({ data: { studentId: student.id, programmeId: programme.id } });
    await prisma.studentSchedule.create({
      data: { studentId: student.id, subjectId: subject.id, weeklyFrequency: 5, priority: 1 },
    });

    check = await timetableCheck();
  });

  it("fails the check — treated as a real misconfiguration", () => {
    expect(check.status).toBe("fail");
  });

  it("counts it in the headline", () => {
    expect(check.summary).toContain("1 problem(s) stopping lessons being scheduled");
  });

  it("says explicitly that nobody is linked", () => {
    expect(check.detail).toContain("NO PARENT LINKED");
  });

  it("explains that no parent-facing action, including rebuild, can ever reach them", () => {
    expect(check.detail).toMatch(/Rebuild today's lessons/);
    expect(check.detail).toMatch(/stays empty however many times/);
  });
});

describe("timetable check: a genuinely short day (case 4)", () => {
  let check: Awaited<ReturnType<typeof timetableCheck>>;

  // This case relies on "tomorrow" landing in the same ISO week as "today" — true every day
  // except Sunday, which would otherwise make this test pass all week and fail on the day the
  // suite happens to run. Pin the clock to a fixed Tuesday so the test is deterministic
  // regardless of when it runs.
  const FIXED_TODAY_KEY = "2025-01-14"; // a Tuesday
  const FIXED_TOMORROW_KEY = addDaysKey(FIXED_TODAY_KEY, 1); // Wednesday, same ISO week

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${FIXED_TODAY_KEY}T12:00:00Z`));

    await resetDb();
    const student = await makeStudent("Rich");
    const { subject, programme } = await makeSubjectWithLessons("maths", 40);
    await prisma.studentEnrolment.create({ data: { studentId: student.id, programmeId: programme.id } });
    await prisma.studentSchedule.create({
      data: { studentId: student.id, subjectId: subject.id, weeklyFrequency: 5, priority: 1 },
    });

    // The planner has run this week — tomorrow already has a full day of lessons — but today
    // itself has nothing on it yet.
    const lessons = await prisma.lesson.findMany({ where: { providerSlug: { startsWith: "maths-" } }, take: 5 });
    const tomorrow = toDateOnly(FIXED_TOMORROW_KEY);
    for (const [i, lesson] of lessons.entries()) {
      await prisma.dailyAssignment.create({
        data: {
          studentId: student.id,
          date: tomorrow,
          order: i,
          kind: "LESSON",
          source: "AUTO",
          subjectId: subject.id,
          lessonId: lesson.id,
          estimatedMinutes: 45,
        },
      });
    }

    check = await timetableCheck();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("does not fail the check — the planner is working, today just has not been planned yet", () => {
    expect(check.status).not.toBe("fail");
  });

  it("is reported at a lower severity", () => {
    expect(check.status).toBe("warn");
  });

  it("does not count towards the headline problem count", () => {
    expect(check.summary).not.toContain("problem(s) stopping lessons being scheduled");
  });

  it("keeps the SHORT DAY wording, naming today's count against the timetable", () => {
    expect(check.detail).toContain("SHORT DAY — 0 of 5 periods");
  });

  it("prints the week so it's clear the planner did run on other days", () => {
    expect(check.detail).toMatch(new RegExp(`this week: .*${FIXED_TOMORROW_KEY}=5`));
  });
});

describe("timetable check: a week nobody has planned yet, despite a future week's lessons (case 5)", () => {
  let check: Awaited<ReturnType<typeof timetableCheck>>;

  beforeAll(async () => {
    await resetDb();
    const student = await makeStudent("Rich");
    const { subject, programme } = await makeSubjectWithLessons("maths", 40);
    await prisma.studentEnrolment.create({ data: { studentId: student.id, programmeId: programme.id } });
    await prisma.studentSchedule.create({
      data: { studentId: student.id, subjectId: subject.id, weeklyFrequency: 5, priority: 1 },
    });

    // Nothing at all in the current week — but one non-moved LESSON assignment dated safely
    // into a later week (the Tuesday of the week after next, so it lands in a later week no
    // matter which day of the current week the suite runs on). Before the upper bound was
    // added to the "this week" query, a stray future-week row like this one would have made
    // the check misreport a genuine SHORT DAY instead of "nothing planned yet".
    const weekStart = weekStartKey(TODAY_KEY);
    const laterWeekDate = toDateOnly(addDaysKey(weekStart, 15));
    const [lesson] = await prisma.lesson.findMany({ where: { providerSlug: { startsWith: "maths-" } }, take: 1 });
    await prisma.dailyAssignment.create({
      data: {
        studentId: student.id,
        date: laterWeekDate,
        order: 0,
        kind: "LESSON",
        source: "AUTO",
        subjectId: subject.id,
        lessonId: lesson.id,
        estimatedMinutes: 45,
      },
    });

    check = await timetableCheck();
  });

  it("does not fail the check — this is not a supply problem", () => {
    expect(check.status).not.toBe("fail");
  });

  it("is reported as a warning, not a short day", () => {
    expect(check.status).toBe("warn");
  });

  it("does not count towards the headline problem count", () => {
    expect(check.summary).not.toContain("problem(s) stopping lessons being scheduled");
  });

  it("says nothing has been planned this week yet, not SHORT DAY", () => {
    expect(check.detail).toContain("NOTHING PLANNED THIS WEEK YET");
    expect(check.detail).not.toContain("SHORT DAY");
  });
});
