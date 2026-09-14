import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { addCustomAssignment, moveAssignment, repeatLesson, upsertSchedule } from "@/lib/admin/schedule";
import { subjectSupply } from "@/lib/scheduling/gaps";
import { ApiError } from "@/lib/auth/api";
import { toDateOnly } from "@/lib/dates";

/**
 * Regression tests for commit eed2064: a lesson clash on repeat/move/add used to bubble up as
 * a bare 500 (the DB's own unique-constraint P2002), and a schedule row saved with
 * weeklyFrequency 0 was saved active, putting every subject on the child's rota.
 */
describe("admin schedule: lesson clashes are said in words", () => {
  let parentId: string;
  let studentId: string;
  let lessonAId: string;
  let lessonATitle: string;
  let lessonBId: string;
  const day1 = "2026-09-14"; // a known Monday
  const day2 = "2026-09-15";
  const day3 = "2026-09-16";
  const day4 = "2026-09-17";

  beforeAll(async () => {
    await resetDb();

    const parentUser = await prisma.user.create({
      data: { role: "PARENT", email: "parent@example.com", passwordHash: "x", displayName: "Parent" },
    });
    parentId = parentUser.id;

    const studentUser = await prisma.user.create({
      data: { role: "STUDENT", username: "eva", passwordHash: "x", displayName: "Eva" },
    });
    await prisma.parentStudentLink.create({ data: { parentId, studentId: studentUser.id } });
    const student = await prisma.studentProfile.create({
      data: { userId: studentUser.id, yearGroup: 7, keyStage: "ks3" },
    });
    studentId = student.id;

    const subject = await prisma.subject.create({ data: { slug: "maths", title: "Maths" } });
    const programme = await prisma.programme.create({
      data: { providerSlug: "maths:7", subjectId: subject.id, yearGroup: 7, keyStage: "ks3", title: "Maths — Year 7" },
    });
    const unit = await prisma.unit.create({
      data: { providerSlug: "fractions", programmeId: programme.id, title: "Fractions", order: 1 },
    });
    const lessonA = await prisma.lesson.create({
      data: { providerSlug: "adding-fractions", unitId: unit.id, title: "Adding fractions", order: 1, estimatedMinutes: 50 },
    });
    lessonAId = lessonA.id;
    lessonATitle = lessonA.title;
    const lessonB = await prisma.lesson.create({
      data: { providerSlug: "subtracting-fractions", unitId: unit.id, title: "Subtracting fractions", order: 2, estimatedMinutes: 50 },
    });
    lessonBId = lessonB.id;

    // lessonA is already on day1, taught by the planner (AUTO / LESSON / not MOVED).
    await prisma.dailyAssignment.create({
      data: {
        studentId,
        date: toDateOnly(day1),
        order: 0,
        kind: "LESSON",
        source: "AUTO",
        status: "PLANNED",
        subjectId: subject.id,
        lessonId: lessonAId,
        estimatedMinutes: 50,
      },
    });

    // lessonB is already on day2.
    await prisma.dailyAssignment.create({
      data: {
        studentId,
        date: toDateOnly(day2),
        order: 0,
        kind: "LESSON",
        source: "AUTO",
        status: "PLANNED",
        subjectId: subject.id,
        lessonId: lessonBId,
        estimatedMinutes: 50,
      },
    });
  });

  it("repeatLesson on the day the lesson is already on throws 409 naming the day", async () => {
    await expect(repeatLesson(parentId, studentId, lessonAId, day1)).rejects.toMatchObject({
      status: 409,
    });
    try {
      await repeatLesson(parentId, studentId, lessonAId, day1);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(409);
      // Named in words: the day of the week, not a stack trace.
      expect(apiErr.message).toMatch(/Monday/);
      expect(apiErr.message).toContain(lessonATitle);
    }
  });

  it("repeatLesson on a free day succeeds and creates a PARENT-sourced PLANNED row", async () => {
    const created = await repeatLesson(parentId, studentId, lessonAId, day3);
    expect(created.source).toBe("PARENT");
    expect(created.status).toBe("PLANNED");
    expect(created.kind).toBe("LESSON");
    expect(created.lessonId).toBe(lessonAId);
    expect(created.date).toEqual(toDateOnly(day3));
    expect(created.createdById).toBe(parentId);
  });

  it("moveAssignment onto a day the lesson is already on throws 409 naming the day", async () => {
    // lessonB is on day2; try to move it onto day1, where lessonA (not lessonB) already sits —
    // no clash there, so first prove the happy path, then prove the clash by moving lessonB's
    // day2 assignment onto day1 after also seeding lessonB onto day1.
    const dupe = await prisma.dailyAssignment.create({
      data: {
        studentId,
        date: toDateOnly(day4),
        order: 0,
        kind: "LESSON",
        source: "AUTO",
        status: "PLANNED",
        subjectId: (await prisma.subject.findFirstOrThrow({ where: { slug: "maths" } })).id,
        lessonId: lessonBId,
        estimatedMinutes: 50,
      },
    });

    await expect(moveAssignment(dupe.id, day2)).rejects.toMatchObject({ status: 409 });
    try {
      await moveAssignment(dupe.id, day2);
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.message).toMatch(/Tuesday/); // 2026-09-15 is a Tuesday
    }
  });

  it("moveAssignment onto a free day succeeds", async () => {
    const assignment = await prisma.dailyAssignment.findFirstOrThrow({
      where: { studentId, lessonId: lessonAId, date: toDateOnly(day3) },
    });
    const moved = await moveAssignment(assignment.id, day4);
    // day4 already has lessonB but not lessonA, so this is not a clash.
    expect(moved.date).toEqual(toDateOnly(day4));
  });

  it("addCustomAssignment for a lesson already on that day throws 409 naming the day", async () => {
    await expect(
      addCustomAssignment(parentId, { studentId, dateKey: day1, title: lessonATitle, lessonId: lessonAId }),
    ).rejects.toMatchObject({ status: 409 });
    try {
      await addCustomAssignment(parentId, { studentId, dateKey: day1, title: lessonATitle, lessonId: lessonAId });
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.message).toMatch(/Monday/);
    }
  });

  it("addCustomAssignment for the same lesson on a free day succeeds as a PARENT PLANNED row", async () => {
    const freeDay = "2026-09-21"; // untouched Monday, a week on
    const created = await addCustomAssignment(parentId, {
      studentId,
      dateKey: freeDay,
      title: lessonATitle,
      lessonId: lessonAId,
    });
    expect(created.source).toBe("PARENT");
    expect(created.status).toBe("PLANNED");
    expect(created.date).toEqual(toDateOnly(freeDay));
  });
});

describe("admin schedule: a subject set to 0 a week is off the timetable", () => {
  let studentId: string;
  let mathsId: string;
  let englishId: string;

  beforeAll(async () => {
    await resetDb();

    const studentUser = await prisma.user.create({
      data: { role: "STUDENT", username: "eva2", passwordHash: "x", displayName: "Eva" },
    });
    const student = await prisma.studentProfile.create({
      data: { userId: studentUser.id, yearGroup: 7, keyStage: "ks3" },
    });
    studentId = student.id;

    const maths = await prisma.subject.create({ data: { slug: "maths", title: "Maths" } });
    mathsId = maths.id;
    const english = await prisma.subject.create({ data: { slug: "english", title: "English" } });
    englishId = english.id;

    // Enrol on both so subjectSupply has a programme to look at for each.
    for (const subject of [maths, english]) {
      const programme = await prisma.programme.create({
        data: {
          providerSlug: `${subject.slug}:7`,
          subjectId: subject.id,
          yearGroup: 7,
          keyStage: "ks3",
          title: subject.title,
        },
      });
      const unit = await prisma.unit.create({
        data: { providerSlug: `${subject.slug}-u1`, programmeId: programme.id, title: "Unit", order: 1 },
      });
      await prisma.lesson.create({
        data: { providerSlug: `${subject.slug}-l1`, unitId: unit.id, title: `${subject.title} lesson`, order: 1 },
      });
      await prisma.studentEnrolment.create({ data: { studentId, programmeId: programme.id } });
    }

    await upsertSchedule(studentId, [
      { subjectId: mathsId, weeklyFrequency: 5, preferredDays: [] },
      { subjectId: englishId, weeklyFrequency: 0, preferredDays: [] },
    ]);
  });

  it("stores weeklyFrequency 0 as active:false and > 0 as active:true", async () => {
    const maths = await prisma.studentSchedule.findUniqueOrThrow({
      where: { studentId_subjectId: { studentId, subjectId: mathsId } },
    });
    expect(maths.active).toBe(true);

    const english = await prisma.studentSchedule.findUniqueOrThrow({
      where: { studentId_subjectId: { studentId, subjectId: englishId } },
    });
    expect(english.active).toBe(false);
  });

  it("subjectSupply, which only reads active rules, does not report the 0/week subject", async () => {
    const supply = await subjectSupply(studentId);
    const titles = supply.map((s) => s.subjectTitle);
    expect(titles).toContain("Maths");
    expect(titles).not.toContain("English");
  });
});
