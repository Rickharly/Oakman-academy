import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { applyCoreTimetable, CORE_TIMETABLE, PERIODS_PER_WEEK } from "@/lib/admin/timetable";

/**
 * The week the family decided on, rather than the default taken from a national curriculum.
 */
describe("the family's week", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("is exactly a week: five periods a day, five days", () => {
    expect(PERIODS_PER_WEEK).toBe(25);
  });

  it("weights it the way they asked — English and maths daily, history and geography light", () => {
    const by = Object.fromEntries(CORE_TIMETABLE.map((r) => [r.subject, r.weeklyFrequency]));
    expect(by.maths).toBe(5);
    expect(by.english).toBe(5);
    // Writing is its own subject with its own period, not something squeezed into English.
    expect(by.writing).toBe(5);
    expect(by.logic).toBeGreaterThan(0);
    expect(by.history).toBeLessThanOrEqual(2);
    expect(by.geography).toBeLessThanOrEqual(2);
  });

  it("puts a child on it, and retires whatever they were on before", async () => {
    const user = await prisma.user.create({
      data: { role: "STUDENT", username: "mikhael", passwordHash: "x", displayName: "Mikhael" },
    });
    const student = await prisma.studentProfile.create({
      data: { userId: user.id, yearGroup: 4, keyStage: "ks2" },
    });

    // An old subject nobody asked for, on the old default week.
    const old = await prisma.subject.create({ data: { provider: "test", slug: "latin", title: "Latin" } });
    await prisma.studentSchedule.create({
      data: { studentId: student.id, subjectId: old.id, weeklyFrequency: 5, priority: 9 },
    });

    await applyCoreTimetable(student.id);

    const active = await prisma.studentSchedule.findMany({
      where: { studentId: student.id, active: true },
      include: { subject: true },
    });
    const slugs = active.map((s) => s.subject.slug).sort();
    expect(slugs).toEqual(CORE_TIMETABLE.map((r) => r.subject).sort());
    // Retired, not deleted — a parent can see what changed.
    const latin = await prisma.studentSchedule.findFirst({
      where: { studentId: student.id, subjectId: old.id },
    });
    expect(latin?.active).toBe(false);
  });

  it("is safe to apply twice and does not duplicate a subject", async () => {
    const user = await prisma.user.create({
      data: { role: "STUDENT", username: "eva", passwordHash: "x", displayName: "Eva" },
    });
    const student = await prisma.studentProfile.create({
      data: { userId: user.id, yearGroup: 7, keyStage: "ks3" },
    });

    await applyCoreTimetable(student.id);
    await applyCoreTimetable(student.id);

    const active = await prisma.studentSchedule.findMany({
      where: { studentId: student.id, active: true },
      include: { subject: true },
    });
    const slugs = active.map((s) => s.subject.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toHaveLength(CORE_TIMETABLE.length);
  });
});
